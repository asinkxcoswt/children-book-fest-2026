import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/content";
import { getTicketConfigs, TicketApiError } from "@/lib/ticketApi";

/** Live ticket availability for an event, proxied so the API key stays server-side. */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const event = slug ? getEvent(slug) : undefined;
  if (!event?.ticketEventCode) {
    return NextResponse.json({ error: "unknown event" }, { status: 404 });
  }

  try {
    const { tickets, refundPolicy } = await getTicketConfigs(event.ticketEventCode);
    // Only the fields the purchase UI needs, in the organizer's display order.
    return NextResponse.json({
      tickets: tickets.map((c) => ({
        code: c.code,
        name: c.name,
        group: c.group ?? null,
        price: c.price,
        limitPerOrder: c.limitPerOrder,
        available: c.available,
        // Session = when the ticket admits you. Drives the outer section
        // headings on the purchase card; group is the inner axis.
        sessionStartAt: c.sessionStartAt ?? null,
        sessionEndAt: c.sessionEndAt ?? null,
        sessionDate: c.sessionDate ?? null,
      })),
      refundPolicy,
    });
  } catch (err) {
    const status = err instanceof TicketApiError ? err.status : 502;
    return NextResponse.json({ error: "ticket service unavailable" }, { status });
  }
}
