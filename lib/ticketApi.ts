/* Ticket platform client (see cow-ticket.llm.txt). Runs anywhere `fetch`
 * exists — a Cloudflare Worker in production, a Node script for the
 * content sync. The caller passes the credentials in; nothing here reads
 * process.env, so the organizer API key can never leak into browser code by
 * an accidental import. Components may import the TYPES only. */

export interface TicketEnv {
  TICKET_API_URL: string;
  TICKET_API_KEY: string;
  TICKET_ACCOUNT_ID: string;
}

function env(e: TicketEnv, name: keyof TicketEnv): string {
  const value = e[name];
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

/** One cached JWT per API key. Lives as long as the isolate/process does; a
 *  Pages Function isolate is recycled often, so expect a token exchange per
 *  cold start — one cheap call, not one per request. */
const cached = new Map<string, { token: string; exp: number }>();

async function getToken(e: TicketEnv): Promise<string> {
  const key = env(e, "TICKET_API_KEY");
  const hit = cached.get(key);
  if (hit && hit.exp - Date.now() > 60_000) return hit.token;
  const res = await fetch(`${env(e, "TICKET_API_URL")}/accounts/token`, {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: env(e, "TICKET_ACCOUNT_ID"),
      type: "customer",
    }),
  });
  if (!res.ok) throw new TicketApiError(502, `token exchange failed: ${res.status}`);
  const data = (await res.json()) as { token: string; exp: string };
  cached.set(key, { token: data.token, exp: new Date(data.exp).getTime() });
  return data.token;
}

async function ticketApi(
  e: TicketEnv,
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<Response> {
  const token = await getToken(e);
  const res = await fetch(`${env(e, "TICKET_API_URL")}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 401 && !retried) {
    cached.delete(env(e, "TICKET_API_KEY")); // token may have expired — refresh once
    return ticketApi(e, path, init, true);
  }
  return res;
}

/** The JWT is account-scoped: any request naming an accountId must name the same
 *  one as the token, or it 401s. */
function accountParam(e: TicketEnv): string {
  return `accountId=${encodeURIComponent(env(e, "TICKET_ACCOUNT_ID"))}`;
}

/** One add-on dimension of a ticket type: "adult", "child", "kit". Every
 *  ticket of this type carries `included` units of it at no extra cost, the
 *  buyer may raise it to `max`, and each unit above `included` costs
 *  `extraPrice`. `included === max` is a fixed, display-only component
 *  (e.g. "1 adult"). A ticket type has 0–5 of these. */
export interface TicketAddOn {
  code: string;
  name: string;
  included: number;
  max: number;
  /** Satang per unit above `included`. */
  extraPrice: number;
  /** When the ticket type's `capacityUnit` is "seats", each unit of this
   *  add-on takes one seat out of `available`. */
  countsAsSeat?: boolean;
  /** Questions asked once per UNIT of this add-on (three children, three name
   *  boxes). Same grammar as the purchase form, minus "email". Answered on the
   *  card path only — the LINE form collects them on the chat path. */
  fields?: PurchaseFormField[];
}

/** Chosen add-on quantities describing EACH ticket in an order item (so an
 *  item with quantity 2 is two identical tickets). Absolute quantities, never
 *  deltas — `qty` lies in [included, max]. */
export interface OrderItemAddOn {
  code: string;
  qty: number;
}

/** Per-unit answers for one ticket: add-on code → one record per unit, in
 *  order, keyed by field key. */
export interface OrderItemUnit {
  addOns: Record<string, Record<string, string>[]>;
}

export interface OrderItemInput {
  code: string;
  quantity: number;
  /** Omitted when the ticket type has no add-ons. */
  addOns?: OrderItemAddOn[];
  /** One entry per ticket (so `quantity` of them), only when an add-on asks
   *  questions, and never on the chat path. */
  units?: OrderItemUnit[];
  passDisplay?: PassDisplay;
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
  /** Live availability: quota − sold − reserved. What one ticket takes out
   *  of it depends on `capacityUnit`. */
  available: number;
  /** "tickets" (default): one unit per ticket. "seats": a ticket takes the
   *  sum of its seat-counting add-ons' quantities — a family ticket with
   *  three children needs four. */
  capacityUnit?: "tickets" | "seats";
  /** Always present on the storefront read; [] when none. */
  addOns?: TicketAddOn[];
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

export async function getTicketConfigs(
  e: TicketEnv,
  eventCode: string,
): Promise<TicketConfigsResult> {
  const res = await ticketApi(
    e,
    `/events/ticketConfigs?eventCode=${encodeURIComponent(eventCode)}&${accountParam(e)}`,
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

export async function createOrder(
  e: TicketEnv,
  input: {
  eventCode: string;
  email: string;
  items: OrderItemInput[];
  metadata?: Record<string, string | number | boolean>;
  /** Link BACK into our site from CowTicket's ticket page, and where a cancelled
   *  Stripe checkout returns to. Send the event page, not the home page — it is
   *  the last point where the buyer can carry on shopping. */
  returnUrl: string;
  theme?: OrderTheme;
  },
): Promise<CreateOrderResult> {
  const res = await ticketApi(e, "/orders", {
    method: "POST",
    body: JSON.stringify({
      accountId: env(e, "TICKET_ACCOUNT_ID"),
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
export async function createOrderIntent(
  e: TicketEnv,
  input: {
  eventCode: string;
  items: OrderItemInput[];
  metadata?: Record<string, string | number | boolean>;
  /** Carried from the intent onto every order the chat creates. */
  returnUrl: string;
  /** Carried onto every order the chat creates, like returnUrl. */
  theme?: OrderTheme;
  },
): Promise<CreateOrderIntentResult> {
  const res = await ticketApi(e, "/orders/intent", {
    method: "POST",
    body: JSON.stringify({
      accountId: env(e, "TICKET_ACCOUNT_ID"),
      ...input,
    }),
  });
  if (!res.ok) throw new TicketApiError(res.status, await res.text());
  return (await res.json()) as CreateOrderIntentResult;
}
