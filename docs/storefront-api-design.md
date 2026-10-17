# CowTicket storefront API — design for a fully static microsite

Status: **superseded in part** (2026-10-17). Decisions so far:

- The checkout success page and the order-status proxy are **dropped** (done on
  branch `static-export`). After creating an order the site redirects to
  `checkoutUrl ?? ticketUrl`, as the CowTicket guide requires. Three routes
  remain to proxy, not four.
- **Done (branch `static-export`): no publishable key in CowTicket.** The
  three remaining proxies run inside a Cloudflare Worker next to the static
  export (see "Cloudflare proxy" below). The publishable-key design further
  down is kept as the longer-term platform feature, not current work.

## Cloudflare proxy (chosen for this site)

A Worker (`worker/index.ts`) that serves `out/` as static assets and routes
`/api/*` to handlers in `functions/api/`. (It started as Cloudflare Pages
Functions; the Cloudflare project turned out to be a Worker, which is also what
Cloudflare now recommends, so the handlers were kept and a tiny router added.)

- `functions/api/tickets.ts`, `functions/api/orders.ts`,
  `functions/api/orders/intent.ts` — ports of the three route handlers. They
  already use plain `fetch`, so the only change is reading secrets from the
  Pages environment (`env.TICKET_API_KEY`, `env.TICKET_ACCOUNT_ID`,
  `env.TICKET_API_URL`) instead of `process.env`, and dropping the filesystem
  read of `content/`: the browser sends `ticketEventCode`, session text and
  venue (all static content it already has) and the Worker validates nothing
  but shape. CowTicket stays the authority on boxes, limits and form answers.
- Same origin as the site, so **no CORS** and no CowTicket change at all.
- The JWT cache lives per isolate; a token exchange per cold start is fine
  (one request a day per isolate).
- Rate limiting is a Cloudflare WAF rule on `/api/orders*` per IP (free plan
  allows one rule), covering the inventory-squatting case without code.
  Turnstile can be added in front of the order button later if bots appear.
- Free tier: 100k Function requests a day; the static pages do not count.
- Tooling: `wrangler` is a dev dependency; `pnpm preview` serves `out/` plus
  the functions locally, reading credentials from `.env.local`.

### Deploying to Cloudflare

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Build output directory | `out` |
| Deploy command | `npx wrangler deploy` (Workers Builds) |
| Variables | `TICKET_API_URL`, `TICKET_ACCOUNT_ID`, `NEXT_PUBLIC_SITE_URL` |
| Secrets | `TICKET_API_KEY` |
| Node version | `NODE_VERSION=22` (or whatever `pnpm build` needs) |

After the first deploy, add a WAF rate-limiting rule (Security → WAF → Rate
limiting rules, one rule is free): path starts with `/api/orders`, 10 requests
per 10 seconds per IP, block for 10 minutes. That is the inventory-squatting
guard; floods on `/api/tickets` are cheap reads and need nothing.

Images: `pnpm images` renders `image-src/content/**` into `public/content/**`
(WebP at 400/800/1600 plus a JPEG share card). The outputs are committed, so
the Pages build needs no sharp and no originals. Re-run it after adding or
replacing a source image.

Verified 2026-10-17 against the CowTicket test environment via `pnpm preview`:
ticket listing, a chat intent from the real UI (QR panel rendered), malformed
bodies rejected with 400. The card path could not be exercised end-to-end
because no test event has STRIPE enabled; its function was shape-tested only.

Everything below this line is the original CowTicket-side design, kept for
when a platform-level public key is wanted.


## Why

The festival site is static content plus four Next route handlers under `app/api/`
that exist only to keep the CowTicket organizer API key off the browser. Removing
them lets the site ship as `output: "export"` and host for free. That means the
browser must call CowTicket directly, which CowTicket today forbids (API key is
secret, CORS allows only the merchant portal origin).

CowTicket already has everything else: the four handlers the proxies call are
`GET /events/ticketConfigs`, `POST /orders`, `POST /orders/intent`,
`GET /orders/detail`, all accepting a `customer`-type JWT. The change is
**one new credential type and a CORS/rate-limit layer in front of those four
routes**, nothing new in the domain.

## What the proxies actually do today (so nothing is lost)

| Proxy route | Platform call | Extra work the proxy does | Where it goes after |
|---|---|---|---|
| `GET /api/tickets?slug` | `GET /events/ticketConfigs` | slug → `ticketEventCode` from `content/`; trims fields | Browser (event JSON is static, pass `ticketEventCode` as a prop) |
| `POST /api/orders` | `POST /orders` | re-validates boxes + purchase-form answers against a fresh config read; builds `passDisplay` from `content/` sessions; `returnUrl` from request origin; sanitizes theme | Browser. Validation becomes UX pre-check only — CowTicket is already the authority and rejects bad input with a 400 and a message |
| `POST /api/orders/intent` | `POST /orders/intent` | same as above minus answers/units | Browser |

Everything the proxies compute comes from `content/` (static) or the request
origin, so it all moves into the client component without any server.

## Design

### 1. A `publishable` API key type

Add `'publishable'` to `ApiKey.type` (today: `customer | organizer | admin`).

- **Created in the portal** under API Keys as "Storefront (public)", shown once,
  prefixed `pk_` so a leaked one is recognisable as safe-to-be-public (and a
  secret one pasted into a browser is recognisable as a mistake).
- Stored hashed like every other key (`apiKeyHash`, `apiKeyId` = last 10 chars),
  same `exp`, same revoke/rotate flow. No new table.
- Two new nullable columns on `ApiKey`:
  - `eventCodes String[]` — empty = any event of the account. The festival key
    lists its event codes, so a key for one client cannot read another client's
    sale on the same account.
  - `allowedOrigins String[]` — origins this key may be used from (see CORS).
- **No token exchange.** The browser sends `api-key: pk_…` on each request. A
  publishable key is public anyway, so a JWT would add a round trip and nothing
  else. `POST /accounts/token` refuses publishable keys (401), so one can never
  be turned into a customer JWT and reach any other route.

A new authorizer `publishableKeyAuth` (next to `apiKeyAuth.ts`):

1. Read `api-key` header; look up by `apiKeyId`, `compareApiKey`, check `exp`,
   check account `active`. Same code path as `createApiKeyAuth`, factored out.
2. Require `type === 'publishable'`.
3. `accountId` comes **from the key**, not the request. If the request names an
   `accountId` it must match (401 otherwise); if it omits one, the handler sees
   the key's. The microsite therefore ships `NEXT_PUBLIC_TICKET_ACCOUNT_ID` only
   for readability — it is not a secret and never was.
4. If `eventCodes` is non-empty, the request's `eventCode` must be in it (403).
   `GET /orders/detail` has no eventCode in the request, so it is checked
   against the loaded order instead (see 2).
5. If `allowedOrigins` is non-empty, the `Origin` header must be in it (403).
   Browsers always send `Origin` on cross-site fetches; a missing header is
   treated as not allowed.
6. Set `authKind = 'publishable'`. `requireScopes` treats it like `customer`
   (no staff scopes, the per-route allow-list is the guard).

Only these four handlers add `publishableKeyAuth` to their `createCompositAuth`
list: `ticketConfigs/storefrontList`, `orders/create`, `orders/createIntent`,
`orders/get`. Every other route keeps rejecting it.

### 2. Per-route rules for a publishable caller

- **`GET /events/ticketConfigs`** — unchanged payload. It is already the buyer-safe
  projection (no counters, no hidden configs).
- **`POST /orders`**, **`POST /orders/intent`** — unchanged payload. The
  `accessToken` in the create-order response was already reaching the browser
  via `ticketUrl`, so nothing new is exposed.
- **`GET /orders/detail`** — with a publishable key the only accepted lookup is
  `accessToken` (never `orderId`), the order's account must equal the key's
  account, and the order's `eventCode` must pass the key's `eventCodes` filter.
  Response is trimmed to what a buyer may see: `orderNo, status, email,
  buyerName, paymentMethod, eventCode, expiresAt, paidAt, items, tickets[]
  {ticketNo, status, principal, ticketConfigId}`. (Only if we keep this route —
  open question 1.)

### 3. CORS

API Gateway v2 evaluates CORS at the gateway, before any Lambda, from one static
`allowOrigins` list. `api-key` is a non-simple header, so every browser call
preflights and the gateway list **must** contain the storefront origin.

- Add `STOREFRONT_ORIGINS: string[]` to `stacks/configurations/{dev,test,prod}.ts`
  and spread it into `cors.allowOrigins` next to `MERCHANT_WEB_URL`. For the
  festival: the workers.dev domain and its custom domain; `localhost:3000`
  is already there for dev.
- The per-key `allowedOrigins` check in the authorizer is the second layer: the
  gateway list is "which sites may talk to this API at all", the key list is
  "which site this key belongs to". Adding a storefront is a config change plus
  a deploy; that is acceptable at the current scale (a handful of storefronts).
  If that becomes a chore, swap the static list for a Lambda-authorizer-driven
  CORS later without changing the key model.
- `allowHeaders` already includes `api-key`. `allowCredentials` stays off; no
  cookies are involved.

### 4. Rate limiting

Threat model: the key is public, so anyone can call these four routes directly.
They can only do what an anonymous buyer on the site can already do, so the
risks are (a) Lambda/DB cost from floods and (b) **inventory squatting**: creating
unpaid orders that hold seats for an hour.

Three layers, two of which exist:

1. **Gateway stage throttle** (exists): 200 rps / 400 burst across all callers.
   Keeps floods cheap. No change.
2. **Per-IP application throttle** on the two mutating routes, built on the
   existing `authThrottle` fixed-window table (`AuthAttempt` rows), keyed by
   `kind + sourceIp`, applied only when `authKind === 'publishable'`:

   | Rule | Limit | Window | Lock |
   |---|---|---|---|
   | `order:ip` | 10 orders | 10 min | 10 min |
   | `intent:ip` | 30 intents | 10 min | 10 min |

   Intents hold no stock, so they are looser. Over the limit → 429 with a plain
   text message the storefront shows as "please try again in a few minutes".
   Source IP is `requestContext.http.sourceIp`; Cloudflare-fronted storefronts
   do not matter here because the browser calls CowTicket directly.
3. **Per-key hold cap**: at most `N` PENDING orders per key per event at any
   moment (`N` = 50 by default, editable on the key). A squatter who rotates IPs
   hits this wall instead of draining the event. Counted with one indexed query
   on `Order(accountId, eventCode, status)`; legitimate rush traffic rarely has
   50 unpaid orders in flight at once, and when it does the organizer can raise
   the number in the portal.

The read route gets no app-level throttle: it is one indexed query and the
stage throttle caps it.

### 5. Observability

- Log `authKind=publishable` and `apiKeyId` on every request so a noisy key is
  attributable; never log the key.
- Reuse the existing SNS alert for 5xx; add a 429-rate alarm on the two mutating
  routes so squatting attempts are noticed.

## Microsite side (after approval)

1. Delete `app/api/**` and the server-side `lib/ticketApi.ts`; replace with a
   browser client `lib/storefront.ts` that sends `api-key` from
   `NEXT_PUBLIC_TICKET_PUBLISHABLE_KEY` to `NEXT_PUBLIC_TICKET_API_URL`.
2. `TicketPurchase` receives `ticketEventCode`, sessions, venue and title as props
   from the server component (build time), computes `passDisplay`, `returnUrl`
   (`window.location.origin`) and the theme itself. Keep `parseBoxes/resolveBoxes`
   as client-side pre-checks so the steppers still behave; the 400 message from
   CowTicket remains the sold-out/limit path.
3. `next.config.ts`: `output: "export"`, image handling per step 3 of the task.
4. `app/checkout/success` — removed (decided 2026-10-17).
5. Remove `TICKET_API_KEY` and `TICKET_ACCOUNT_ID` from `.env.example`; add the
   two public vars.
6. Update `cow-ticket.llm.txt` (and CowTicket's `integration-guide.md`) to describe
   the publishable key and drop the "proxy through your backend" rule for sell-only
   storefronts.

## Open questions for review

1. ~~Success page~~ — decided: dropped.
2. **Static gateway CORS list vs. per-key dynamic CORS.** Proposed: static list
   now (config + deploy per new storefront), dynamic later if needed.
3. **Per-key PENDING cap default of 50** — fine for the festival? It is a knob,
   not a hard rule.
4. ~~Branching~~ — working on `static-export`.
