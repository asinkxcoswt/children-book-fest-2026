# CowTicket: per-ticket add-ons

Spec for the backend change that the storefront (`children-book-fest-2026`) has already been built against. Read `cow-ticket.llm.txt` (the current public contract) first; this document only describes what changes. Everything below is additive and backwards compatible: a ticket type with no add-ons behaves exactly as today.

## 1. Why

The organizer sells family tickets: one ticket at 200 THB admits 1 adult + 1 child, and each extra child costs +50 THB. This is not "buy several tickets". It is **one ticket whose composition the buyer adjusts**. Modelling it as separate ticket types ("family", "extra child") would need cross-item dependency rules the API has no place for. Instead, a ticket type carries **add-ons**, and each ticket in an order records the add-on quantities it was bought with.

## 2. Domain model

### 2.1 `TicketAddOn` (new, child of `TicketConfig`)

| Field        | Type   | Rules |
|--------------|--------|-------|
| `code`       | string | Unique within the ticket type. Immutable once anything has been sold. Letters, numbers, underscores, starts with a letter. |
| `name`       | string | Display label, organizer's own text, e.g. "ผู้ใหญ่", "เด็ก", "Workshop kit". |
| `included`   | int ≥ 0 | Units every ticket of this type carries at no extra cost. |
| `max`        | int ≥ `included` | Upper bound per ticket. `max === included` means a fixed, display-only component. |
| `extraPrice` | int ≥ 0 (satang) | Price per unit **above** `included`. |
| `sortOrder`  | int | Display order within the ticket type. |

A ticket type has **0 to 5** add-ons. Reject the 6th.

Examples:

```
Family ticket, price 20000
  adult  included 1  max 1  extraPrice 0       → fixed "1 adult"
  child  included 1  max 4  extraPrice 5000    → 1 included, up to 3 extra at ฿50 each
```

### 2.2 Order item (changed)

An order item is **N identical tickets**. It gains an optional `addOns` list that describes **each** ticket in the item:

```
items: [
  { code: "20261207-1830", quantity: 2,
    addOns: [ { code: "adult", qty: 1 }, { code: "child", qty: 3 } ] }
]
```

Quantities are **absolute**, not deltas, and lie in `[included, max]`. Two tickets with different compositions are two items with the same `code`, so **duplicate ticket codes within one order are now legal**.

Snapshot on the order item, as the unit price is today: each add-on's `code`, `name`, `qty`, `included`, `extraPrice` at purchase time. Later edits to the ticket type never touch placed orders.

### 2.3 Pricing

```
itemUnitPrice = ticketConfig.price + Σ max(0, qty − included) × extraPrice
itemTotal     = itemUnitPrice × quantity
```

The storefront computes the same thing for display only. CowTicket's number is the one charged.

### 2.4 Capacity

**Unchanged.** `quantity`, `sold`, `reserved`, `available` and `limitPerOrder` on a ticket type all count **tickets**, not people. A family ticket admitting four is one unit. Seat-based accounting is explicitly out of scope for now.

### 2.5 Issued tickets

One issued ticket (one QR, one `ticketNo`) per unit of quantity, as today. It redeems once. Each issued ticket carries its add-on composition so the ticket page, scanner and exports can show a headcount line such as "ผู้ใหญ่ 1 · เด็ก 3".

## 3. API changes

### 3.1 `GET /events/ticketConfigs` (storefront read)

Each row gains `addOns: TicketAddOn[]` in `sortOrder`, always present, `[]` when none. Fields: `code`, `name`, `included`, `max`, `extraPrice`. Omit `sortOrder`; the array order is the order.

### 3.2 `GET /ticketConfigs` (merchant read)

Same `addOns` array, plus `sortOrder` per add-on.

### 3.3 `POST /ticketConfigs` and `PUT /ticketConfigs`

Accept optional `addOns: [{ code?, name, included, max, extraPrice }]`. The list **replaces** the whole set, like `purchaseForm` on events. Omit `code` to have one generated.

Rejections (plain-text reason, as elsewhere):
- more than 5 add-ons
- duplicate `code` within the type
- `max < included`, negative values, non-integers
- removing or renaming the `code` of an add-on that appears on any order (change `name`, `included`, `max`, `extraPrice` freely; those only affect new orders)

### 3.4 `POST /orders` and `POST /orders/intent`

Each item accepts optional `addOns: [{ code, qty }]`.

Validation, 400 with a plain-text reason:
- `addOns` given on a ticket type that has none, or an unknown add-on `code`
- `qty` outside `[included, max]`
- an add-on **missing** from the list: fill it in at `included` (do not reject). The storefront always sends the full list, but a lenient default is safer.
- Duplicate ticket `code` across items is allowed. `limitPerOrder` applies to the **sum of quantity across all items of that code** in the order.

Intents carry `addOns` onto every order the chat creates, exactly as `passDisplay` and `theme` do.

### 3.5 `GET /orders/detail`

`items[]` gains `addOns: [{ code, name, qty, included, extraPrice }]` from the snapshot, plus `unitPrice` (satang, including extras) if not already exposed. `tickets[]` gains the same `addOns` composition.

## 4. Surfaces that must display add-ons

- **Ticket page** (hosted, gate-critical): under each ticket, one line listing add-ons with `qty > 0`, e.g. "ผู้ใหญ่ 1 · เด็ก 3". Add-ons with `qty === 0` are omitted.
- **Order summary / receipt** on the ticket page: per item, the base price and each extra as its own line ("เด็กเพิ่ม 2 × ฿50").
- **Scanner / check-in result**: show the headcount line prominently. Gate staff must see "admits 4" at a glance when the QR scans.
- **Organizer portal** order view and **participant exports**: one column per add-on code in the event, holding `qty`.
- **LINE chat** order summary and confirmation: same composition line per ticket.
- **Stripe Checkout** line items: one line per order item with the unit price including extras, description carrying the composition.

## 5. Out of scope

- Seat-based capacity (counting people against a room). Do not add it now.
- Per-ticket attendee names; `principal` stays per order item.
- Add-ons with their own inventory.
- Per-add-on refunds; refunds remain whole-order.

## 6. Storefront contract already implemented

The storefront ([lib/ticketApi.ts](../lib/ticketApi.ts), [lib/orderItems.ts](../lib/orderItems.ts)) already:
- reads `addOns` from `GET /events/ticketConfigs` and treats a missing field as `[]`
- validates boxes client-side and again server-side against a fresh config read
- folds identical tickets into one item with a `quantity` and sends `addOns` only when the type has any
- never sends an add-on quantity outside `[included, max]`, and never sends more of one code than `limitPerOrder`

Until this backend change ships, the storefront is wired to a local mock (`TICKET_MOCK_ADDONS=1`) that fakes the `addOns` field; nothing else on the storefront needs to change when the real field appears.

## 7. Acceptance checks

1. Create a ticket type with the family add-ons above. `GET /events/ticketConfigs` returns them in order.
2. Order 1 ticket with child qty 3 → unit price 30000, one issued ticket showing "ผู้ใหญ่ 1 · เด็ก 3", `sold` increases by 1.
3. Order 2 items of the same code with different compositions in one order → accepted, two issued tickets with the right compositions, `limitPerOrder` enforced on the sum.
4. Order with child qty 5 (max 4) → 400 with a readable reason, nothing reserved.
5. Order with no `addOns` on a type that has them → accepted at included values, unit price 20000.
6. Change `extraPrice` after an order is placed → the order and its tickets still show the old price.
7. Try to delete the `child` add-on after a sale → refused; renaming it is allowed.
8. A ticket type with no add-ons behaves byte-for-byte as before on every endpoint.
9. Chat checkout via `POST /orders/intent` with add-ons → the LINE summary shows the composition and the created order carries it.
