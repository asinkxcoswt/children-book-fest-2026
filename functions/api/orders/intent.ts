import { createOrderIntent, sanitizeTheme } from "../../../lib/ticketApi";
import type { IntentResponse } from "../../../lib/storefront";
import {
  type Ctx,
  fail,
  json,
  mapError,
  parseEventCode,
  parseItems,
  parseTheme,
  readJson,
  returnUrlFor,
} from "../../_lib";

/** Starts a chat purchase. Collects nothing from the buyer — no email, no
 *  attendee fields — because the LINE conversation asks for whatever the
 *  organizer requires, and only once stock is about to be held. Nothing is
 *  reserved here, so calling it repeatedly is safe and cheap. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const body = await readJson(request);
  if (!body) return fail("invalid request", 400);

  const eventCode = parseEventCode(body.eventCode);
  const returnUrl = returnUrlFor(request, body.slug);
  if (!eventCode || !returnUrl) return fail("unknown event", 404);

  // Per-unit questions are asked by the LINE form, never sent from here.
  const items = parseItems(body.items, { allowUnits: false });
  if (!items) return fail("invalid form data", 400);

  try {
    const intent = await createOrderIntent(env, {
      eventCode,
      items,
      // The buyer's tickets arrive in the LINE chat as a link to CowTicket's own
      // ticket page; this is only their way back into the festival site.
      returnUrl,
      theme: sanitizeTheme(parseTheme(body.theme)),
    });
    const res: IntentResponse = { intentCode: intent.intentCode, lineUrl: intent.lineUrl };
    return json(res);
  } catch (err) {
    return mapError(err);
  }
}
