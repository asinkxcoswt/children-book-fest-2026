import crypto from "crypto";

/* Server-only ticket platform client (see integration-guide.md).
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
  name: string;
  /** Optional section label chosen by the organizer (e.g. a day or session);
   *  null means ungrouped. Display text only — no shared behaviour. */
  group: string | null;
  /** Satang (THB minor units); 0 = free. */
  price: number;
  currency: string;
  limitPerOrder: number;
  startSellingDate: string | null;
  endSellingDate: string | null;
  /** Live availability: quota − sold − reserved. */
  available: number;
}

/** Organizer's refund terms — must be shown near the checkout button. */
export interface RefundPolicy {
  allowed: boolean;
  termEn: string;
  termTh: string;
}

export interface TicketConfigsResult {
  /** In the organizer's display order — render as-is, never re-sort. */
  tickets: TicketConfig[];
  refundPolicy: RefundPolicy | null;
}

export async function getTicketConfigs(eventCode: string): Promise<TicketConfigsResult> {
  const res = await ticketApi(
    `/events/ticketConfigs?eventCode=${encodeURIComponent(eventCode)}&${accountParam()}`,
  );
  if (!res.ok) throw new TicketApiError(res.status, await res.text());
  const data = (await res.json()) as { data: TicketConfig[]; refundPolicy?: RefundPolicy };
  return { tickets: data.data, refundPolicy: data.refundPolicy ?? null };
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
  status: "PENDING" | "PAID";
  expiresAt: string;
  /** null for free orders — skip the redirect. */
  checkoutUrl: string | null;
}

export async function createOrder(input: {
  eventCode: string;
  email: string;
  items: { code: string; quantity: number; passDisplay?: PassDisplay }[];
  metadata?: Record<string, string | number | boolean>;
  successUrl: string;
  cancelUrl: string;
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

export type OrderStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELED" | "REFUNDED";

export interface IssuedTicket {
  /** Internal uuid — API use only, never shown to humans. */
  id: string;
  /** Human-friendly ticket number (TK-XXXX-XXXX) — goes in the QR and on screen. */
  ticketNo: string;
  status: string;
  principal: string;
}

export interface OrderDetail {
  id: string;
  /** Human-friendly order reference (CT-XXXXXX) — show to the buyer. */
  orderNo: string;
  status: OrderStatus;
  email: string;
  eventCode: string;
  expiresAt: string;
  paidAt: string | null;
  /** Populated once the order is PAID. */
  tickets?: IssuedTicket[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const res = await ticketApi(
    `/orders/detail?orderId=${encodeURIComponent(orderId)}&${accountParam()}`,
  );
  if (!res.ok) throw new TicketApiError(res.status, await res.text());
  return (await res.json()) as OrderDetail;
}

/** Unguessable key for the ticket-page URL. CowTicket has no per-buyer identity —
 *  tickets are bearer instruments — so the link itself is the secret and must stay
 *  stable: buyers reopen it from the confirmation email weeks later, at the gate.
 *  Set ORDER_SECURITY_SECRET. Falling back to TICKET_API_KEY ties every issued
 *  link to the payment credential, so rotating that key breaks them all. */
export function generateOrderToken(email: string, eventCode: string): string {
  const secret = process.env.ORDER_SECURITY_SECRET || env("TICKET_API_KEY");
  return crypto
    .createHmac("sha256", secret)
    .update(`${email.trim().toLowerCase()}:${eventCode}`)
    .digest("hex");
}
