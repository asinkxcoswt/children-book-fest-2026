import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/content";
import { createOrderIntent, getTicketConfigs, TicketApiError } from "@/lib/ticketApi";
import { pick, formatDate } from "@/lib/i18n";

interface IntentRequestBody {
  slug?: string;
  items?: { code?: string; quantity?: number }[];
}

/** Starts a chat purchase. Unlike the card route this collects nothing from the
 *  buyer — no email, no attendee fields — because the LINE conversation asks for
 *  whatever the organizer requires, and only once stock is about to be held.
 *  Nothing is reserved here, so calling it repeatedly is safe and cheap. */
export async function POST(request: NextRequest) {
  let body: IntentRequestBody;
  try {
    body = (await request.json()) as IntentRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const event = body.slug ? getEvent(body.slug) : undefined;
  if (!event?.ticketEventCode) {
    return NextResponse.json({ error: "unknown event" }, { status: 404 });
  }

  const items = (body.items ?? []).filter(
    (i): i is { code: string; quantity: number } =>
      typeof i.code === "string" && Number.isInteger(i.quantity) && (i.quantity as number) > 0,
  );
  if (items.length === 0) {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  try {
    const { paymentMethods } = await getTicketConfigs(event.ticketEventCode);
    if (!paymentMethods.includes("PROMPTPAY")) {
      return NextResponse.json({ error: "chat checkout is not available" }, { status: 400 });
    }

    // Same display text as the card path — the platform still doesn't know our
    // event's date or venue, and these tickets are issued the same way.
    const { venue, sessions } = event.schedule;
    const passDisplayFor = (code: string) => {
      const s = sessions.find((sess) => sess.ticketCodes?.includes(code)) ?? sessions[0];
      return {
        main: pick(event.title),
        date: `${s.date}T${s.start}:00+07:00`,
        dateDisplay: `${formatDate(s.date)} ${s.start} · ${pick(venue)}`,
        // No principal: the chat collects the attendee name if the organizer
        // asks for one, and guessing here would only overwrite their answer.
      };
    };

    const intent = await createOrderIntent({
      eventCode: event.ticketEventCode,
      items: items.map((i) => ({ ...i, passDisplay: passDisplayFor(i.code) })),
      successUrl: `${origin}/checkout/success?orderId={ORDER_ID}&token={ORDER_TOKEN}`,
    });

    return NextResponse.json({ intentCode: intent.intentCode, lineUrl: intent.lineUrl });
  } catch (err) {
    if (err instanceof TicketApiError && err.status === 400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "ticket service unavailable" }, { status: 502 });
  }
}
