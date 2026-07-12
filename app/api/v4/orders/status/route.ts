import { NextRequest, NextResponse } from "next/server";
import { getOrderDetail, TicketApiError } from "@/lib/ticketApi";

const ORDER_COOKIE = "ticketOrderId";

/** Order status for the success page poller. The orderId comes from the
 *  httpOnly cookie set at order creation — never from the client. */
export async function GET(request: NextRequest) {
  const orderId = request.cookies.get(ORDER_COOKIE)?.value;
  if (!orderId) {
    return NextResponse.json({ error: "no order" }, { status: 404 });
  }

  try {
    const order = await getOrderDetail(orderId);
    return NextResponse.json({ status: order.status, email: order.email });
  } catch (err) {
    const status = err instanceof TicketApiError ? err.status : 502;
    return NextResponse.json({ error: "ticket service unavailable" }, { status });
  }
}
