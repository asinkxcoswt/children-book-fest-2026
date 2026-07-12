import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/content";
import { createOrder, TicketApiError } from "@/lib/ticketApi";
import { pick, formatDate } from "@/lib/i18n";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_COOKIE = "ticketOrderId";

interface OrderRequestBody {
  slug?: string;
  /** Parent / buyer full name. */
  name?: string;
  childName?: string;
  email?: string;
  phone?: string;
  items?: { code?: string; quantity?: number }[];
}

/** Creates a platform order for a v4 event and returns the Stripe checkout URL
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
  const phone = body.phone?.trim() ?? "";
  const items = (body.items ?? []).filter(
    (i): i is { code: string; quantity: number } =>
      typeof i.code === "string" && Number.isInteger(i.quantity) && (i.quantity as number) > 0,
  );
  if (!EMAIL_RE.test(email) || !name || !childName || items.length === 0) {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  // Wallet-pass display text comes from our content data (the platform doesn't
  // know the event's date or venue).
  const passDisplay = {
    main: pick(event.title),
    date: `${event.schedule.date}T${event.schedule.start}:00+07:00`,
    dateDisplay: `${formatDate(event.schedule.date)} ${event.schedule.start} · ${pick(event.schedule.venue)}`,
    principal: name,
  };

  const origin = request.nextUrl.origin;
  try {
    const order = await createOrder({
      eventCode: event.ticketEventCode,
      email,
      items: items.map((i) => ({ ...i, passDisplay })),
      // Purchase-form data for the merchant (flat scalars only — see guide §4.4).
      metadata: { parentName: name, childName, ...(phone && { phone }) },
      successUrl: `${origin}/v4/checkout/success`,
      cancelUrl: `${origin}/v4/event/${event.slug}`,
    });

    const res = NextResponse.json({
      status: order.status,
      checkoutUrl: order.checkoutUrl,
    });
    res.cookies.set(ORDER_COOKIE, order.orderId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60, // matches the order's 1-hour expiry
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
