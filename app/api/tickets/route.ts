import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/content";
import { getTicketConfigs, TicketApiError, type TicketAddOn } from "@/lib/ticketApi";

/** Sample add-ons for reviewing the purchase UI before CowTicket ships the
 *  real field. Attached only when TICKET_MOCK_ADDONS=1 is set locally AND the
 *  platform sent none; never set it in production config. */
const MOCK_ADDONS: TicketAddOn[] = [
  { code: "adult", name: "ผู้ใหญ่", included: 1, max: 1, extraPrice: 0 },
  { code: "child", name: "เด็ก", included: 1, max: 4, extraPrice: 5000 },
];
const mockAddOns = process.env.TICKET_MOCK_ADDONS === "1";

/** Live ticket availability for an event, proxied so the API key stays server-side. */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const event = slug ? getEvent(slug) : undefined;
  if (!event?.ticketEventCode) {
    return NextResponse.json({ error: "unknown event" }, { status: 404 });
  }

  try {
    const { tickets, refundPolicy, paymentMethods, purchaseForm } = await getTicketConfigs(
      event.ticketEventCode,
    );
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
        // ASSUMED API — per-ticket add-ons (see TicketAddOn). Empty until the
        // platform ships it, which the UI renders as a plain ticket.
        addOns: c.addOns ?? (mockAddOns ? MOCK_ADDONS : []),
      })),
      refundPolicy,
      // Which checkout buttons the purchase UI may render, and the organizer's
      // own checkout questions — both come from the platform, never from us.
      paymentMethods,
      purchaseForm,
    });
  } catch (err) {
    const status = err instanceof TicketApiError ? err.status : 502;
    return NextResponse.json({ error: "ticket service unavailable" }, { status });
  }
}
