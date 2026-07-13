# Storefront Integration Guide — Ticket System API

How to integrate a **Next.js (App Router)** storefront with the ticket platform. This document is
self-contained — everything you need is here, no access to the platform repo required.

## 1. What the platform does (and doesn't)

The ticket platform is a **headless commerce core**. Responsibilities split:

| Storefront (you)                                                                          | Ticket platform (this API)                                                                   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Event pages: name, dates, venue, description, images, SEO                                 | Ticket types + live availability per event                                                   |
| Checkout UI, purchase form (any fields you want)                                          | Inventory reservation, order lifecycle, expiry                                               |
| Redirecting the buyer to Stripe                                                           | Stripe Checkout session + webhook handling                                                   |
| **Ticket page** (`successUrl`): renders each ticket **with a QR code of its `ticketNo`** | Issuing tickets; sending the buyer a confirmation email that links back to your `successUrl` |

**Important**: the platform does not render ticket UI and does not send wallet passes. The
confirmation email it sends contains only an order summary and a **"View my tickets" button
pointing at your `successUrl`** — buyers will open that page days later at the venue, so it must
be a durable, self-contained page (see §4.2) that shows each ticket's QR code (encode the
`ticketNo`, e.g. `TK-7K4M-2QW9` — gate scanners look it up, and staff can type it by hand).

The link between your event pages and the platform is the **`eventCode`** — a stable slug
(e.g. `concert-2026-01-01`) registered by the merchant in their portal. You never create events,
ticket types, or prices from the storefront; you read availability and create orders.

**Money is always THB, in satang** (minor units): `price: 150000` = ฿1,500.00. `price: 0` = free ticket.

## 2. Environments & credentials

Server-side environment variables (e.g. `.env.local`):

```bash
TICKET_API_URL=https://test-api.cow-ticket.dev   # prod: https://api.cow-ticket.dev
TICKET_API_KEY=<customer-type API key from the merchant>   # SECRET — server only
TICKET_ACCOUNT_ID=<merchant accountId, e.g. my-merchant>
```

**Every call to the ticket API must be made server-side** (Route Handlers, Server Components,
Server Actions):

1. The API key is a secret — it must never reach the browser.
2. The API's CORS policy only allows the merchant portal origin — browser `fetch` from your
   domain will be blocked anyway.

## 3. Authentication

The API key is not sent on business endpoints. Instead you exchange it for a short-lived JWT
(**customer** type) and send that as a Bearer token:

```
POST {TICKET_API_URL}/accounts/token
Headers: api-key: {TICKET_API_KEY}, Content-Type: application/json
Body: { "accountId": "{TICKET_ACCOUNT_ID}", "type": "customer", "customerId": "storefront" }

200 → { "token": "<jwt>", "exp": "<ISO datetime>" }
```

- `customerId` is your choice of stable identifier for the storefront (e.g. `"storefront"`).
  **Remember it — the same value must be echoed in later requests** (see below).
- Tokens expire (~2h). Cache the token server-side and refresh when `exp` is near or on a 401.

**The `customerId` echo rule**: with a customer-type JWT, the API cross-checks that your request
carries the same `accountId` and `customerId` as the token. Concretely:

- `GET` requests → include `accountId` and `customerId` as **query params**.
- `POST` requests → include `accountId` and `customerId` in the **JSON body**.

If they're missing or different you get `401 Unauthorized`.

Recommended token helper:

```ts
// lib/ticketApi.ts  (server-only module)
import 'server-only';

const API = process.env.TICKET_API_URL!;
const ACCOUNT_ID = process.env.TICKET_ACCOUNT_ID!;
const CUSTOMER_ID = 'storefront';

let cached: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.exp - Date.now() > 60_000) return cached.token;
  const res = await fetch(`${API}/accounts/token`, {
    method: 'POST',
    headers: { 'api-key': process.env.TICKET_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, type: 'customer', customerId: CUSTOMER_ID }),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = await res.json();
  cached = { token: data.token, exp: new Date(data.exp).getTime() };
  return data.token;
}

export async function ticketApi(path: string, init?: RequestInit & { retried?: boolean }): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store'
  });
  if (res.status === 401 && !init?.retried) {
    cached = null; // token may have expired — refresh once
    return ticketApi(path, { ...init, retried: true });
  }
  return res;
}

export { ACCOUNT_ID, CUSTOMER_ID };
```

## 4. Endpoint reference

Errors come back as plain-text messages with meaningful status codes: `400` (validation /
sold out / not in selling period), `401` (auth), `404`-ish lookups also use `400` with a
"not found" message. Show the message to the user for sold-out/limit errors.

### 4.1 Ticket availability

```
GET /events/ticketConfigs?eventCode={eventCode}&accountId={ACCOUNT_ID}&customerId={CUSTOMER_ID}
Authorization: Bearer <jwt>

200 → {
  "data": [
    {
      "id": "…",
      "eventCode": "concert-2026-01-01",
      "code": "vip",                    // use this in order items
      "name": "VIP Ticket",
      "price": 150000,                  // satang; 0 = free
      "currency": "thb",
      "limitPerOrder": 4,
      "startSellingDate": "2026-06-01T00:00:00.000Z" | null,
      "endSellingDate": "2026-08-01T12:00:00.000Z" | null,
      "available": 37                   // live: quota − sold − reserved (incl. pending orders)
    }
  ],
  "total": 1
}
```

Only ticket types that are ACTIVE **and currently inside their selling window** are returned —
you don't need to filter. `available` already accounts for unpaid pending orders. Render
`available === 0` as sold out; a type can reappear if a pending order expires (they expire after
1 hour), so re-fetch on page load rather than caching for long (`cache: 'no-store'` or
`revalidate: 30`).

### 4.2 Create order

```
POST /orders
Authorization: Bearer <jwt>

{
  "accountId": "{ACCOUNT_ID}",
  "customerId": "{CUSTOMER_ID}",            // echo rule — not stored on the order
  "eventCode": "concert-2026-01-01",
  "email": "buyer@example.com",             // ticket delivery address — validate it!
  "items": [
    {
      "code": "vip",
      "quantity": 2,                        // 1..limitPerOrder
      "passDisplay": { ... }                // optional, see 4.3 — strongly recommended
    }
  ],
  "metadata": { "shirtSize": "XL", "heardFrom": "facebook" },   // optional, see 4.4
  "successUrl": "https://your-site.com/orders/{ORDER_ID}",      // {ORDER_ID} substituted by the platform
  "cancelUrl": "https://your-site.com/events/concert-2026-01-01"
}

200 → {
  "orderId": "0d9c1e9e-…",                  // internal uuid — use in API calls
  "orderNo": "CT-7K4M2Q",                   // human-friendly reference — show to the buyer
  "status": "PENDING",                      // or "PAID" for free orders
  "expiresAt": "2026-07-12T13:00:00.000Z",  // 1 hour from creation
  "checkoutUrl": "https://checkout.stripe.com/c/pay/…"   // null for free orders
}

400 → "Sold out: vip" | "Not in selling period: vip" | "Quantity for vip must be between 1 and 4"
```

What happens server-side: inventory is reserved atomically (so the buyer's tickets are held for
the whole hour), a Stripe Checkout Session with the same 1-hour expiry is created, and the URL is
returned. **Redirect the buyer to `checkoutUrl`.**

- **`{ORDER_ID}` placeholder**: put the literal string `{ORDER_ID}` anywhere in `successUrl`
  (and/or `cancelUrl`) and the platform replaces it with the real order id before creating the
  Stripe session. Your success page URL therefore always knows which order it is for.
- **`successUrl` is also the buyer's permanent ticket page.** The confirmation email's
  "View my tickets" button points at it, and buyers will reopen it at the venue — possibly weeks
  later, on a different device, with no cookies. So make it a stable route like
  `/orders/{ORDER_ID}` that fetches the order server-side and renders the tickets. Do not rely on
  session state for it.
- **Free orders** (`total = 0`): `checkoutUrl` is `null` and `status` is already `PAID` — skip
  the redirect and navigate straight to the (substituted) success URL yourself. Tickets are
  issued and the confirmation email is sent immediately.
- Unpaid orders expire after 1 hour; the Stripe link dies at the same moment and the held
  inventory is released.

### 4.3 `passDisplay` — display data stored on each ticket

The platform doesn't know your event's date or venue, so **you** provide display text per order
item. It's stored on each issued ticket and comes back in ticket/order reads — the merchant's
redemption console shows it to gate staff, and you can use it when rendering the ticket page.
Every field is optional; omitted fields fall back to defaults (event name, ticket type name,
order date, buyer email, `-`).

```jsonc
{
  "main": "New Year Concert 2026", // headline (default: event name)
  "description": "VIP — Standing Zone A", // (default: ticket type name)
  "head": "VIP", // small header label
  "date": "2026-01-01T19:00:00+07:00", // ISO datetime
  "dateDisplay": "1 Jan 2026, 19:00", // human-formatted date line
  "principal": "John Doe", // attendee name (default: buyer email)
  "zone": "A",
  "seat": "12"
}
```

Always send at least `principal` (collect the attendee name in your purchase form) — gate staff
search tickets by that name when a QR won't scan.

### 4.4 `metadata` — your purchase-form data

Arbitrary JSON stored on the order and shown to the merchant (order detail + aggregated
analytics). For the analytics to work well, keep it a **flat object of scalar values**
(`{"shirtSize": "XL"}`, not nested arrays). Don't put payment data or anything sensitive here.

### 4.5 Poll order status (success page)

The Stripe redirect alone doesn't prove payment — always confirm via the API:

```
GET /orders/detail?orderId={orderId}&accountId={ACCOUNT_ID}&customerId={CUSTOMER_ID}
Authorization: Bearer <jwt>

200 → {
  "id": "…",                                 // internal uuid
  "orderNo": "CT-7K4M2Q",                    // show this to the buyer
  "status": "PENDING" | "PAID" | "EXPIRED" | "CANCELED" | "REFUNDED",
  "email": "buyer@example.com",
  "eventCode": "…", "event": { "eventCode": "…", "name": "…" },
  "expiresAt": "…", "paidAt": "…" | null,
  "items": [ { "quantity": 2, "unitPrice": 150000, "ticketConfig": { "code": "vip", "name": "VIP Ticket", "price": 150000 } } ],
  "payment": { "provider": "stripe", "status": "PENDING" | "SUCCEEDED" | "REFUNDED", "amount": 300000, … },
  "tickets": [ { "id": "…", "ticketNo": "TK-7K4M-2QW9", "status": "CLAIMED", "principal": "John Doe", "ownerEmail": "…", "claimedEmail": "…" } ]
}
```

Poll every ~2s (webhooks usually land within seconds of payment) with a ~60s timeout:

- `PAID` → render the tickets (see 4.6). A confirmation email linking back to this page has
  been sent to the buyer.
- still `PENDING` after timeout → show "payment processing — you'll receive an email"; do NOT
  show an error (webhook may just be slow).
- `EXPIRED` → the buyer took longer than 1 hour; send them back to the event page.

### 4.6 Rendering tickets (your job)

Once the order is `PAID`, `tickets[]` from `GET /orders/detail` is your source of truth. Every
ticket carries a human-friendly **`ticketNo`** (`TK-XXXX-XXXX`) alongside its internal uuid `id`,
and the order carries **`orderNo`** (`CT-XXXXXX`) — show these to humans, never the uuids. For
each ticket render a card with:

- **a QR code encoding `ticketNo`** (e.g. with the `qrcode` npm package) — gate scanners accept
  either `ticketNo` or the uuid, but `ticketNo` doubles as a short code staff can type by hand.
  Render it black-on-white, ≥200px.
- the holder name (`principal`), ticket type, and whatever event info your page already has.
- **`ticketNo` as visible text under the QR** — the manual-entry fallback when a screen won't scan.
- the **`orderNo`** somewhere on the page ("Order CT-XXXXXX") — it's what the confirmation email
  shows and what buyers will quote to support and gate staff.

The same page doubles as the buyer's permanent ticket wallet (the email links to it), so keep it
fast, mobile-first, and bright enough to scan a screen in daylight. There are no Apple/Google
Wallet passes — don't render "Add to Wallet" buttons.

## 5. End-to-end flow recap

```
Event page                createOrderAction              Stripe            Ticket page (successUrl)
    │  GET availability        │                            │                   │
    │──────────────────────►   │                            │                   │
    │  buyer picks tickets,    │                            │                   │
    │  fills form, submits ──► │ POST /orders               │                   │
    │                          │  (reserve + session) ────► │                   │
    │                          │ redirect to checkoutUrl ─► │ buyer pays        │
    │                          │                            │ ── redirect ────► │ poll /orders/detail
    │                          │   (platform webhook: issue tickets, email      │  … until PAID
    │                          │    "View my tickets" link → successUrl)        │ render tickets + QR codes
    │                          │                                                │       ▲
    │                          │              buyer reopens email later ────────┘  (same page, any device)
```

## 8. Testing

- Test environment: `https://test-api.cow-ticket.dev` with a test-mode Stripe account behind it.
- Card `4242 4242 4242 4242`, any future expiry, any CVC → success.
- `4000 0000 0000 0002` → declined (order stays PENDING; buyer can retry within the hour).
- Create a free ticket type (price 0) to test the no-Stripe path.
- To test expiry without waiting an hour, ask the platform team to shorten `ORDER_EXPIRY_SECONDS`
  on the test stage, or just abandon a checkout and verify the availability count returns after
  the sweep (≤5 min after expiry).

## 8. Gotchas checklist

- [ ] All ticket-API calls are server-side (`server-only` module) — the API key and JWT never reach the browser.
- [ ] `accountId` + `customerId` echoed on every request (query for GET, body for POST).
- [ ] Prices rendered as `price / 100` THB; never send prices back (the platform snapshots them).
- [ ] `successUrl` uses the `{ORDER_ID}` placeholder and works cold (no cookies/session) — it's the buyer's permanent ticket page, linked from the confirmation email.
- [ ] Ticket page renders a **black-on-white QR of each ticket `id`**; no wallet buttons.
- [ ] `passDisplay.principal` (attendee name) collected and sent — gate staff search by it.
- [ ] Buyer email validated before order creation — the confirmation email goes there.
- [ ] Success page polls the API; never trusts the redirect.
- [ ] Free orders skip the redirect (`checkoutUrl === null`).
- [ ] Sold-out / limit / selling-period 400s surfaced to the buyer with the API's message.
- [ ] 401 handling: refresh the token once, then fail.
- [ ] Order metadata is flat scalars; no sensitive data.
