import { NextRequest, NextResponse } from "next/server";
import { getOrderDetail, getTicketPassUrl, TicketApiError } from "@/lib/ticketApi";

const ORDER_COOKIE = "ticketOrderId";

/** Wallet-pass link for one of the current order's tickets. The ticket must
 *  belong to the order in the httpOnly cookie — no fishing for other ids. */
export async function GET(request: NextRequest) {
  const orderId = request.cookies.get(ORDER_COOKIE)?.value;
  const ticketId = request.nextUrl.searchParams.get("ticketId") ?? "";
  const platform = request.nextUrl.searchParams.get("platform");
  if (!orderId || !ticketId || (platform !== "apple" && platform !== "google")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  try {
    const order = await getOrderDetail(orderId);
    if (!(order.tickets ?? []).some((tk) => tk.id === ticketId)) {
      return NextResponse.json({ error: "unknown ticket" }, { status: 404 });
    }
    const url = await getTicketPassUrl(ticketId, platform);
    return NextResponse.json({ url });
  } catch (err) {
    const status = err instanceof TicketApiError ? err.status : 502;
    return NextResponse.json({ error: "ticket service unavailable" }, { status });
  }
}
