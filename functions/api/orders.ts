import { createOrder, sanitizeTheme } from "../../lib/ticketApi";
import type { OrderResponse } from "../../lib/storefront";
import {
  type Ctx,
  fail,
  json,
  mapError,
  parseAnswers,
  parseEventCode,
  parseItems,
  parseTheme,
  readJson,
  returnUrlFor,
} from "../_lib";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates a card order and returns where to send the buyer: Stripe Checkout,
 *  or CowTicket's ticket page for a free order. We host nothing after this. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const body = await readJson(request);
  if (!body) return fail("invalid request", 400);

  const eventCode = parseEventCode(body.eventCode);
  const returnUrl = returnUrlFor(request, body.slug);
  if (!eventCode || !returnUrl) return fail("unknown event", 404);

  // Per-unit answers (child names) ride along on the card path only.
  const items = parseItems(body.items, { allowUnits: true });
  const answers = parseAnswers(body.answers);
  if (!items || !answers) return fail("invalid form data", 400);

  // A card-selling event always carries a required email field (the platform
  // injects one for the Stripe receipt), so this should never be empty — but
  // the order call requires it, so fail loudly rather than send "".
  const email = answers.email ?? "";
  if (!EMAIL_RE.test(email)) return fail("invalid form data", 400);

  try {
    const order = await createOrder(env, {
      eventCode,
      email,
      items,
      // Purchase-form answers for the organizer's exports — flat scalars only.
      metadata: answers,
      returnUrl,
      theme: sanitizeTheme(parseTheme(body.theme)),
    });
    const res: OrderResponse = {
      status: order.status,
      // The client redirects to checkoutUrl when set, otherwise ticketUrl —
      // that one rule covers both the paid and the free case.
      checkoutUrl: order.checkoutUrl,
      ticketUrl: order.ticketUrl,
    };
    return json(res);
  } catch (err) {
    return mapError(err);
  }
}
