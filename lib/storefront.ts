/* The contract between the browser and our Cloudflare Pages Functions under
 * /api. Shared by both sides so a field cannot drift. Everything here is
 * types only — no secrets, no fetch. */

import type {
  OrderItemInput,
  OrderTheme,
  PaymentMethod,
  PurchaseFormField,
  RefundPolicy,
  TicketAddOn,
} from "./ticketApi";

/** One ticket type as the purchase UI sees it: the platform's TicketConfig
 *  trimmed to what a buyer may know. */
export interface TicketOption {
  code: string;
  /** The round number ("รอบที่ 1"); the day and time come from the session. */
  name: string;
  /** Organizer's section label for anything that is NOT time — zone, tier,
   *  package. null = ungrouped. */
  group: string | null;
  /** Satang; 0 = free. */
  price: number;
  limitPerOrder: number;
  /** What one ticket takes out of this depends on `capacityUnit`. */
  available: number;
  /** "tickets": one unit per ticket. "seats": a ticket takes the sum of its
   *  seat-counting add-ons' quantities — a family of four needs four. */
  capacityUnit: "tickets" | "seats";
  /** Calendar day the ticket admits on (YYYY-MM-DD, resolved by the platform
   *  in Asia/Bangkok), or null for an event with no sessions. */
  sessionDate: string | null;
  sessionStartAt: string | null;
  sessionEndAt: string | null;
  /** Per-ticket composition dimensions (adult, child, kit…). Empty = a plain
   *  ticket with nothing to configure. */
  addOns: TicketAddOn[];
}

/** GET /api/tickets?eventCode= */
export interface TicketsResponse {
  tickets: TicketOption[];
  refundPolicy: RefundPolicy | null;
  paymentMethods: PaymentMethod[];
  purchaseForm: PurchaseFormField[];
}

/** POST /api/orders — a card purchase. The browser resolves its boxes into
 *  platform items (with passDisplay from our own content) before posting;
 *  the function only checks shape and adds the secrets. CowTicket is the
 *  authority on codes, limits, stock and the purchase form. */
export interface OrderRequest {
  eventCode: string;
  /** Our event page slug, for the link back from the ticket page. */
  slug: string;
  items: OrderItemInput[];
  /** Answers keyed by the organizer's `purchaseForm` field keys. */
  answers: Record<string, string>;
  theme?: OrderTheme;
}

export interface OrderResponse {
  status: "PENDING" | "PAID";
  /** Redirect here when set, otherwise to `ticketUrl`. */
  checkoutUrl: string | null;
  ticketUrl: string;
}

/** POST /api/orders/intent — a chat purchase. No answers, no units: LINE
 *  collects them. */
export interface IntentRequest {
  eventCode: string;
  slug: string;
  items: OrderItemInput[];
  theme?: OrderTheme;
}

export interface IntentResponse {
  intentCode: string;
  lineUrl: string;
}

/** Every error body from /api. `error` is safe to show to the buyer. */
export interface ErrorResponse {
  error: string;
}
