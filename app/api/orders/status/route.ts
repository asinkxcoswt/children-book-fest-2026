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

    // A ticket admits to ONE session, so its date line must be that session's —
    // not the event's whole schedule. Both tickets and order items carry
    // ticketConfigId, so join on that: ticket → item → code → session.
    const sessionByCode = new Map(
      event?.schedule.sessions.flatMap((s) => (s.ticketCodes ?? []).map((code) => [code, s])) ?? [],
    );
    const sessionByConfigId = new Map(
      (order.items ?? []).flatMap((i) => {
        const session = sessionByCode.get(i.ticketConfig.code);
        return session ? [[i.ticketConfigId, session] as const] : [];
      }),
    );
    const tickets = order.tickets ?? [];
    const allSessions = event
      ? event.schedule.sessions.map((s) => `${formatDate(s.date)} · ${s.start}–${s.end}`).join(" / ")
      : "";

    return NextResponse.json({
      status: order.status,
      orderNo: order.orderNo,
      email: order.email,
      event: event
        ? {
          title: pick(event.title),
          venue: pick(event.schedule.venue),
          color: category?.color ?? "bubblegum",
          festivalName: `${t("festivalName")} ${t("festivalYear")}`,
        }
        : null,
      tickets: tickets.map((tk) => {
        const session = sessionByConfigId.get(tk.ticketConfigId);
        if (!session) {
          // Ticket code retired from content, or an unmapped session — show the
          // whole schedule rather than a confidently wrong date.
          console.warn(`order ${order.orderNo}: no session for ticketConfigId ${tk.ticketConfigId}`);
        }
        return {
          ticketNo: tk.ticketNo,
          principal: tk.principal,
          dateDisplay: session
            ? `${formatDate(session.date)} · ${session.start}–${session.end}`
            : allSessions,
        };
      }),
    });
  } catch (err) {
    const status = err instanceof TicketApiError ? err.status : 502;
    return NextResponse.json({ error: "ticket service unavailable" }, { status });
  }
}
