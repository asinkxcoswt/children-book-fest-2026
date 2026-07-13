import { NextRequest, NextResponse } from "next/server";
import { getOrderDetail, TicketApiError, generateOrderToken } from "@/lib/ticketApi";
import { getEvents, getCategory } from "@/lib/content";
import { pick, formatDate, t } from "@/lib/i18n";

/** Order status for the success page poller. The orderId comes from the
 *  httpOnly cookie set at order creation — never from the client. Once PAID,
 *  the response includes issued tickets plus display info for rendering
 *  saveable ticket images. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const orderId = searchParams.get("orderId");
  const token = searchParams.get("token");

  if (!orderId || !token) {
    return NextResponse.json({ error: "missing parameters" }, { status: 400 });
  }

  try {
    const order = await getOrderDetail(orderId);

    // Verify token matches generated token for this order's email and eventCode
    const expectedToken = generateOrderToken(order.email, order.eventCode);
    if (token !== expectedToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Map the platform eventCode back to our content event for display text.
    const event = getEvents().find((e) => e.ticketEventCode === order.eventCode);
    const category = event ? getCategory(event.category) : undefined;

    return NextResponse.json({
      status: order.status,
      email: order.email,
      event: event
        ? {
          title: pick(event.title),
          dateDisplay: `${formatDate(event.schedule.date)} · ${event.schedule.start}–${event.schedule.end}`,
          venue: pick(event.schedule.venue),
          color: category?.color ?? "bubblegum",
          festivalName: `${t("festivalName")} ${t("festivalYear")}`,
        }
        : null,
      tickets: (order.tickets ?? []).map((tk) => ({ id: tk.id, principal: tk.principal })),
    });
  } catch (err) {
    const status = err instanceof TicketApiError ? err.status : 502;
    return NextResponse.json({ error: "ticket service unavailable" }, { status });
  }
}
