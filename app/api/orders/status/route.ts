import { NextRequest, NextResponse } from "next/server";
import { getOrderDetail, TicketApiError } from "@/lib/ticketApi";
import { getEvents, getCategory } from "@/lib/content";
import { pick, formatDate, t } from "@/lib/i18n";

/** Order status for the success page poller. The token in the query string is
 *  the platform's per-order accessToken — the credential itself, so the platform
 *  rejects a wrong one and we do no comparison of our own. Once PAID, the
 *  response carries the admissible tickets plus display info for rendering
 *  saveable ticket images. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "missing parameters" }, { status: 400 });
  }

  try {
    const order = await getOrderDetail(token);

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
    const allSessions = event
      ? event.schedule.sessions.map((s) => `${formatDate(s.date)} · ${s.start}–${s.end}`).join(" / ")
      : "";

    // A refunded order's tickets are rejected at the gate, and a REDEEMED or
    // VOIDED ticket is not admissible either — never hand back a scannable code
    // for any of them, or the buyer finds out at the front of the queue.
    const issued =
      order.status === "REFUNDED"
        ? []
        : (order.tickets ?? []).filter((tk) => tk.status === "ISSUED");
    const withheld = (order.tickets ?? []).length - issued.length;

    return NextResponse.json({
      status: order.status,
      orderNo: order.orderNo,
      // Both are null on a chat order — the client renders nothing rather than
      // a placeholder.
      email: order.email,
      buyerName: order.buyerName,
      paymentMethod: order.paymentMethod ?? null,
      event: event
        ? {
          title: pick(event.title),
          venue: pick(event.schedule.venue),
          color: category?.color ?? "bubblegum",
          festivalName: `${t("festivalName")} ${t("festivalYear")}`,
        }
        : null,
      tickets: issued.map((tk) => {
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
      /** Tickets already scanned or cancelled — shown as a note, never as a QR. */
      withheld,
    });
  } catch (err) {
    const status = err instanceof TicketApiError ? err.status : 502;
    return NextResponse.json({ error: "ticket service unavailable" }, { status });
  }
}
