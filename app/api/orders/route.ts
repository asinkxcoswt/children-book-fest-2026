import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/content";
import {
  createOrder,
  getTicketConfigs,
  ticketPageUrl,
  TicketApiError,
  type PurchaseFormField,
} from "@/lib/ticketApi";
import { pick, formatDate } from "@/lib/i18n";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OrderRequestBody {
  slug?: string;
  /** Answers keyed by the organizer's `purchaseForm` field keys. */
  answers?: Record<string, unknown>;
  items?: { code?: string; quantity?: number }[];
}

/** Validates the buyer's answers against the organizer's own form definition.
 *  The client renders the form, but the platform owns which fields exist and
 *  which are required — so we re-check here against a fresh read rather than
 *  trusting whatever shape the browser posted. */
function validateAnswers(
  form: PurchaseFormField[],
  answers: Record<string, unknown>,
): { values: Record<string, string> } | { error: string } {
  const values: Record<string, string> = {};
  for (const field of form) {
    const raw = answers[field.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (field.required) return { error: `missing field: ${field.key}` };
      continue; // optional and blank — omit rather than storing ""
    }
    if (field.type === "email" && !EMAIL_RE.test(value)) {
      return { error: `invalid email: ${field.key}` };
    }
    if (field.type === "select" && field.options?.length && !field.options.includes(value)) {
      return { error: `invalid option: ${field.key}` };
    }
    values[field.key] = value;
  }
  return { values };
}

/** Creates a card order and returns the Stripe checkout URL (null for free
 *  orders). We host nothing after this point: Stripe returns the buyer to
 *  CowTicket's ticket page, and `returnUrl` is only their way back to us. */
export async function POST(request: NextRequest) {
  let body: OrderRequestBody;
  try {
    body = (await request.json()) as OrderRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const event = body.slug ? getEvent(body.slug) : undefined;
  if (!event?.ticketEventCode) {
    return NextResponse.json({ error: "unknown event" }, { status: 404 });
  }

  const items = (body.items ?? []).filter(
    (i): i is { code: string; quantity: number } =>
      typeof i.code === "string" && Number.isInteger(i.quantity) && (i.quantity as number) > 0,
  );
  if (items.length === 0) {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  try {
    const { purchaseForm, paymentMethods } = await getTicketConfigs(event.ticketEventCode);
    if (!paymentMethods.includes("STRIPE")) {
      // Card checkout was turned off between page load and submit.
      return NextResponse.json({ error: "card payment is not available" }, { status: 400 });
    }

    const checked = validateAnswers(purchaseForm, body.answers ?? {});
    if ("error" in checked) {
      return NextResponse.json({ error: "invalid form data" }, { status: 400 });
    }
    const { values } = checked;

    // A card-selling event always carries a required email field (the platform
    // injects one for the Stripe receipt), so this should never be empty — but
    // the order call requires it, so fail loudly rather than send "".
    const email = values.email ?? "";
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "invalid form data" }, { status: 400 });
    }

    // Wallet-pass display text comes from our content data (the platform doesn't
    // know the event's date or venue). Multi-day events map each ticket code to
    // its session via `ticketCodes`; unmapped codes fall back to the first session.
    const { venue, sessions } = event.schedule;
    const passDisplayFor = (code: string) => {
      const s = sessions.find((sess) => sess.ticketCodes?.includes(code)) ?? sessions[0];
      return {
        main: pick(event.title),
        // description is left to default to the ticket type name ("รอบที่ 1") —
        // dateDisplay below already carries the date and time.
        date: `${s.date}T${s.start}:00+07:00`,
        dateDisplay: `${formatDate(s.date)} ${s.start} · ${pick(venue)}`,
        // "principal" is the reserved attendee-name key; gate staff search by it.
        principal: values.principal,
      };
    };

    const order = await createOrder({
      eventCode: event.ticketEventCode,
      email,
      items: items.map((i) => ({ ...i, passDisplay: passDisplayFor(i.code) })),
      // Purchase-form answers for the organizer's exports — flat scalars only.
      metadata: values,
      returnUrl: `${origin}/event/${event.slug}`,
    });

    return NextResponse.json({
      status: order.status,
      checkoutUrl: order.checkoutUrl,
      // Free orders skip Stripe, so they are the one case we hand the buyer the
      // hosted ticket page ourselves.
      ticketUrl: ticketPageUrl(order.orderId, order.accessToken),
    });
  } catch (err) {
    if (err instanceof TicketApiError && err.status === 400) {
      // Sold out / limit / selling period — surface the platform's message.
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "ticket service unavailable" }, { status: 502 });
  }
}
