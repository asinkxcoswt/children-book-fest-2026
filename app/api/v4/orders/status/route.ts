import { NextRequest, NextResponse } from "next/server";
import { getOrderDetail, TicketApiError } from "@/lib/ticketApi";
import { getEvents, getCategory } from "@/lib/content";
import { pick, formatDate, t } from "@/lib/i18n";

const ORDER_COOKIE = "ticketOrderId";

/** Order status for the success page poller. The orderId comes from the
 *  httpOnly cookie set at order creation — never from the client. Once PAID,
 *  the response includes issued tickets plus display info for rendering
 *  saveable ticket images. */
export async function GET(request: NextRequest) {
  const orderId = request.cookies.get(ORDER_COOKIE)?.value;
  if (!orderId) {
    return NextResponse.json({ error: "no order" }, { status: 404 });
  }

  try {
    const order = await getOrderDetail(orderId);

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
