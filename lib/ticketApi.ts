/* Server-only ticket platform client (see cow-ticket.llm.txt).
 * IMPORTANT: only import this from Route Handlers / Server Components — the API
 * key and JWT must never reach the browser. (Consider adding the `server-only`
 * package for a build-time guarantee.) */

function env(name: "TICKET_API_URL" | "TICKET_API_KEY" | "TICKET_ACCOUNT_ID"): string {
  const value = process.env[name];
  if (!value) throw new TicketApiError(503, `Ticket API not configured (missing ${name})`);
  return value;
}

/** Error carrying the platform's plain-text message and status. */
export class TicketApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let cached: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.exp - Date.now() > 60_000) return cached.token;
  const res = await fetch(`${env("TICKET_API_URL")}/accounts/token`, {
    method: "POST",
    headers: { "api-key": env("TICKET_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: env("TICKET_ACCOUNT_ID"),
      type: "customer",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new TicketApiError(502, `token exchange failed: ${res.status}`);
  const data = (await res.json()) as { token: string; exp: string };
  cached = { token: data.token, exp: new Date(data.exp).getTime() };
  return data.token;
}

async function ticketApi(path: string, init?: RequestInit, retried = false): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${env("TICKET_API_URL")}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (res.status === 401 && !retried) {
    cached = null; // token may have expired — refresh once
    return ticketApi(path, init, true);
  }
  return res;
}

/** The JWT is account-scoped: any request naming an accountId must name the same
 *  one as the token, or it 401s. /orders/detail additionally 400s without it. */
function accountParam(): string {
  return `accountId=${encodeURIComponent(env("TICKET_ACCOUNT_ID"))}`;
}

export interface TicketConfig {
  id: string;
  eventCode: string;
  code: string;
  /** Required by the platform. On this festival's tickets it is the round
   *  number ("รอบที่ 1") — the day and time come from the session fields. */
  name: string;
  /** Optional section label chosen by the organizer, for anything that is NOT
   *  time — zone, tier, add-on, package. Null means ungrouped. Display text
   *  only: same-group items share no behaviour, and a buyer may mix groups in
   *  one order. Sessions live in the session* fields below, not here. */
  group: string | null;
  /** Satang (THB minor units); 0 = free. */
  price: number;
  currency: string;
  limitPerOrder: number;
  /** When the ticket is ON SALE — not when it admits you. */
  startSellingDate: string | null;
  endSellingDate: string | null;
  /** When the ticket ADMITS you (ISO 8601), or null. Distinct from the selling
   *  window above: for a multi-round event this is the only thing telling two
   *  otherwise identical tickets apart. */
  sessionStartAt: string | null;
  sessionEndAt: string | null;
  /** Calendar day of sessionStartAt (YYYY-MM-DD), resolved by the platform in
   *  Asia/Bangkok. Prefer this over local timezone maths so our sections match
   *  the organizer's portal exactly. */
  sessionDate: string | null;
  /** Live availability: quota − sold − reserved. */
  available: number;
}

/** Organizer's refund terms — must be shown near the checkout button. */
export interface RefundPolicy {
  allowed: boolean;
  termEn: string;
  termTh: string;
}

/** Checkout paths the organizer enabled. Anything we don't recognise is dropped
 *  rather than rendered as a dead button. */
export type PaymentMethod = "STRIPE" | "PROMPTPAY";

/** One question the organizer wants asked at checkout. Render exactly these,
 *  in this order — never invent fields. Answers go back as `metadata` keyed by
 *  `key`; the reserved key "principal" is the attendee name and must also be
 *  sent as `passDisplay.principal`. */
export interface PurchaseFormField {
  key: string;
  type: "text" | "tel" | "email" | "select";
  required: boolean;
  labelTh: string;
  labelEn: string;
  /** Present (and non-empty) only for type "select". */
  options?: string[];
  /** True when the platform added the field rather than the organizer — a
   *  card-selling event always gets a required email this way. Render it like
   *  any other field. */
  auto?: boolean;
}

export interface TicketConfigsResult {
  /** In the organizer's display order — render as-is, never re-sort. */
  tickets: TicketConfig[];
  refundPolicy: RefundPolicy | null;
  /** Which checkout buttons to render. Empty means the platform sent nothing
   *  usable; treat as card-only, matching the platform's own default. */
  paymentMethods: PaymentMethod[];
  /** The organizer's checkout questions. Often empty — an event selling only
   *  through chat asks nothing on the web at all. */
  purchaseForm: PurchaseFormField[];
}

const KNOWN_METHODS: PaymentMethod[] = ["STRIPE", "PROMPTPAY"];

export async function getTicketConfigs(eventCode: string): Promise<TicketConfigsResult> {
  const res = await ticketApi(
    `/events/ticketConfigs?eventCode=${encodeURIComponent(eventCode)}&${accountParam()}`,
  );
  if (!res.ok) throw new TicketApiError(res.status, await res.text());
  const data = (await res.json()) as {
    data: TicketConfig[];
    refundPolicy?: RefundPolicy;
    paymentMethods?: string[];
    purchaseForm?: PurchaseFormField[];
  };
  // An unrecognised method is one we don't support yet, not an error — drop it
  // so a future platform addition can't render a button that goes nowhere.
  const paymentMethods = (data.paymentMethods ?? []).filter((m): m is PaymentMethod =>
    (KNOWN_METHODS as string[]).includes(m),
  );
  return {
    tickets: data.data,
    refundPolicy: data.refundPolicy ?? null,
    paymentMethods: paymentMethods.length ? paymentMethods : ["STRIPE"],
    purchaseForm: data.purchaseForm ?? [],
  };
}

/** Brand colours for CowTicket's hosted ticket page. Hex only ("#rgb" or
 *  "#rrggbb") — anything else, or any key the platform doesn't know, is a 400
 *  that fails the whole order, so validate before sending. Snapshotted onto the
 *  order at creation, so tickets already sold keep the look they were bought
 *  with. Text colours are computed from luminance; QR codes, status colours and
 *  layout are deliberately not themeable. */
export interface OrderTheme {
  primaryColor?: string;
  secondaryColor?: string;
}

/** The platform's accepted grammar, applied on our side too: a rejected theme
 *  costs the buyer their order, so a bad colour is worth dropping rather than
 *  sending. */
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Keeps only well-formed hex values, and returns undefined if nothing is left —
 *  the platform then uses its own defaults. */
export function sanitizeTheme(theme: OrderTheme | undefined): OrderTheme | undefined {
  if (!theme) return undefined;
  const clean: OrderTheme = {};
  if (theme.primaryColor && HEX_RE.test(theme.primaryColor)) clean.primaryColor = theme.primaryColor;
  if (theme.secondaryColor && HEX_RE.test(theme.secondaryColor)) {
    clean.secondaryColor = theme.secondaryColor;
  }
  return clean.primaryColor || clean.secondaryColor ? clean : undefined;
}

export interface PassDisplay {
  main?: string;
  description?: string;
  head?: string;
  date?: string;
  dateDisplay?: string;
  principal?: string;
  zone?: string;
  seat?: string;
}

export interface CreateOrderResult {
  orderId: string;
  orderNo: string;
  /** Per-order secret proving a visitor is entitled to THIS order. It is the
   *  credential the ticket page reads — treat it like a password. */
  accessToken: string;
  status: "PENDING" | "PAID";
  expiresAt: string;
  /** null for free orders — there is nothing to pay. */
  checkoutUrl: string | null;
  /** CowTicket's hosted ticket page for this order. Take it from the response
   *  rather than building it: the shape of the URL belongs to the platform.
   *  Stripe returns paying buyers here itself; a free order goes straight here. */
  ticketUrl: string;
}

export async function createOrder(input: {
  eventCode: string;
  email: string;
  items: { code: string; quantity: number; passDisplay?: PassDisplay }[];
  metadata?: Record<string, string | number | boolean>;
  /** Link BACK into our site from CowTicket's ticket page, and where a cancelled
   *  Stripe checkout returns to. Send the event page, not the home page — it is
   *  the last point where the buyer can carry on shopping. */
  returnUrl: string;
  theme?: OrderTheme;
}): Promise<CreateOrderResult> {
  const res = await ticketApi("/orders", {
    method: "POST",
    body: JSON.stringify({
      accountId: env("TICKET_ACCOUNT_ID"),
      ...input,
    }),
  });
  if (!res.ok) throw new TicketApiError(res.status, await res.text());
  return (await res.json()) as CreateOrderResult;
}

export interface CreateOrderIntentResult {
  /** Short code the buyer sends to the LINE OA (CTI-XXXXXX). */
  intentCode: string;
  /** Deep link that opens LINE with the code pre-filled. */
  lineUrl: string;
}

/** Starts a chat purchase instead of a card one. Holds no inventory and never
 *  expires — the 1-hour hold begins only when the order is created in chat, so
 *  there is nothing here to count down and nothing to release. Deliberately
 *  takes no email and no cancelUrl: the buyer fills in nothing on the web. */
export async function createOrderIntent(input: {
  eventCode: string;
  items: { code: string; quantity: number; passDisplay?: PassDisplay }[];
  metadata?: Record<string, string | number | boolean>;
  /** Carried from the intent onto every order the chat creates. */
  returnUrl: string;
  /** Carried onto every order the chat creates, like returnUrl. */
  theme?: OrderTheme;
}): Promise<CreateOrderIntentResult> {
  const res = await ticketApi("/orders/intent", {
    method: "POST",
    body: JSON.stringify({
      accountId: env("TICKET_ACCOUNT_ID"),
      ...input,
    }),
  });
  if (!res.ok) throw new TicketApiError(res.status, await res.text());
  return (await res.json()) as CreateOrderIntentResult;
}

export type OrderStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELED" | "REFUNDED";

/** ISSUED alone is admissible. REDEEMED has already been scanned and VOIDED was
 *  cancelled — both must render without a QR, or the page hands out a code the
 *  gate will reject in front of a queue. */
export type TicketStatus = "ISSUED" | "REDEEMED" | "VOIDED";

export interface IssuedTicket {
  /** Internal uuid — API use only, never shown to humans. */
  id: string;
  /** Human-friendly ticket number (TK-XXXX-XXXX) — goes in the QR and on screen. */
  ticketNo: string;
  status: TicketStatus;
  principal: string;
  /** Joins the ticket to its order item, and so to the session it admits to. */
  ticketConfigId: string;
}

export interface OrderItem {
  quantity: number;
  ticketConfigId: string;
  ticketConfig: { code: string; name: string };
}

export interface OrderDetail {
  id: string;
  /** Human-friendly order reference (CT-XXXXXX) — show to the buyer. */
  orderNo: string;
  status: OrderStatus;
  /** Null on a chat order — the buyer never gave one. Never render a
   *  placeholder in its place; show nothing. */
  email: string | null;
  /** The buyer's LINE display name on a chat order, otherwise null. */
  buyerName: string | null;
  paymentMethod?: "STRIPE" | "PROMPTPAY" | "FREE";
  eventCode: string;
  expiresAt: string;
  paidAt: string | null;
  /** One row per ticket type ordered, with its quantity. */
  items?: OrderItem[];
  /** Populated once the order is PAID. */
  tickets?: IssuedTicket[];
}

/** Reads an order by its accessToken — the credential, not the id. The order id
 *  is an identifier that turns up in logs and support threads; only the token
 *  proves entitlement, so it is what we address the order by. */
export async function getOrderDetail(accessToken: string): Promise<OrderDetail> {
  const res = await ticketApi(
    `/orders/detail?accessToken=${encodeURIComponent(accessToken)}&${accountParam()}`,
  );
  if (!res.ok) throw new TicketApiError(res.status, await res.text());
  return (await res.json()) as OrderDetail;
}
