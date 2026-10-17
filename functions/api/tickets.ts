import { getTicketConfigs } from "../../lib/ticketApi";
import type { TicketsResponse } from "../../lib/storefront";
import { type Ctx, fail, json, mapError, parseEventCode } from "../_lib";

/** Live ticket availability for an event, proxied so the organizer API key
 *  stays on the server. The browser names the platform event code directly:
 *  it is public (it is in every ticket URL) and the account-scoped JWT means
 *  a code from another account returns nothing. */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const eventCode = parseEventCode(new URL(request.url).searchParams.get("eventCode"));
  if (!eventCode) return fail("unknown event", 404);

  try {
    const { tickets, refundPolicy, paymentMethods, purchaseForm } = await getTicketConfigs(
      env,
      eventCode,
    );
    // Only the fields the purchase UI needs, in the organizer's display order.
    const body: TicketsResponse = {
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
        // Per-ticket add-ons and how a ticket is counted against stock.
        capacityUnit: c.capacityUnit ?? "tickets",
        addOns: (c.addOns ?? []).map((a) => ({
          code: a.code,
          name: a.name,
          included: a.included,
          max: a.max,
          extraPrice: a.extraPrice,
          countsAsSeat: a.countsAsSeat ?? false,
          fields: a.fields ?? [],
        })),
      })),
      refundPolicy,
      // Which checkout buttons the purchase UI may render, and the organizer's
      // own checkout questions — both come from the platform, never from us.
      paymentMethods,
      purchaseForm,
    };
    return json(body);
  } catch (err) {
    return mapError(err);
  }
}
