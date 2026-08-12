import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/content";
import { createOrder, TicketApiError, generateOrderToken } from "@/lib/ticketApi";
import { pick, formatDate } from "@/lib/i18n";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OrderRequestBody {
  slug?: string;
  /** Parent / buyer full name. */
  name?: string;
  childName?: string;
  email?: string;
  /** Free-form contact: phone, LINE ID, Facebook — required. */
  contact?: string;
  items?: { code?: string; quantity?: number }[];
}

/** Creates a platform order for an event and returns the Stripe checkout URL
 *  (null for free orders). The orderId goes into an httpOnly cookie so the
 *  success page can poll it without exposing it in the URL. */
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

  const email = body.email?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const childName = body.childName?.trim() ?? "";
  const contact = body.contact?.trim() ?? "";
  const items = (body.items ?? []).filter(
    (i): i is { code: string; quantity: number } =>
      typeof i.code === "string" && Number.isInteger(i.quantity) && (i.quantity as number) > 0,
  );
  if (!EMAIL_RE.test(email) || !name || !childName || !contact || items.length === 0) {
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
      date: `${s.date}T${s.start}:00+07:00`,
      dateDisplay: `${formatDate(s.date)} ${s.start} · ${pick(venue)}`,
      principal: name,
    };
  };

  const origin = request.nextUrl.origin;
  try {
    const token = generateOrderToken(email, event.ticketEventCode);
    const order = await createOrder({
      eventCode: event.ticketEventCode,
      email,
      items: items.map((i) => ({ ...i, passDisplay: passDisplayFor(i.code) })),
      // Purchase-form data for the merchant (flat scalars only — see guide §4.4).
      metadata: { parentName: name, childName, contact },
      successUrl: `${origin}/checkout/success?orderId={ORDER_ID}&token=${token}`,
      cancelUrl: `${origin}/event/${event.slug}`,
    });

    const res = NextResponse.json({
      status: order.status,
      checkoutUrl: order.checkoutUrl,
      orderId: order.orderId,
      token: token,
    });
    return res;
  } catch (err) {
    if (err instanceof TicketApiError && err.status === 400) {
      // Sold out / limit / selling period — surface the platform's message.
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "ticket service unavailable" }, { status: 502 });
  }
}
