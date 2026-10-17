/* Shared pieces for the /api handlers under functions/api, dispatched by
 * worker/index.ts. These run on Cloudflare Workers, not Node: web `fetch`, `Request`, `Response` only.
 * Bundled by wrangler, so plain relative imports into lib/ are fine. */

import type { OrderItemInput, OrderTheme, PassDisplay } from "../lib/ticketApi";
import { TicketApiError } from "../lib/ticketApi";
import type { ErrorResponse } from "../lib/storefront";

/** Set as Pages environment variables (production/preview) or in .dev.vars
 *  for `wrangler dev`. Never NEXT_PUBLIC_, never in the bundle. */
export interface Env {
  TICKET_API_URL: string;
  TICKET_API_KEY: string;
  TICKET_ACCOUNT_ID: string;
}

/** The subset of Cloudflare's EventContext we use, typed here so the project
 *  needs no workers-types package. */
export interface Ctx {
  request: Request;
  env: Env;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function fail(error: string, status: number): Response {
  return json({ error } satisfies ErrorResponse, status);
}

/** The buyer-facing answer to anything that went wrong talking to CowTicket.
 *  A 400 carries the platform's own message (sold out, limit, selling period)
 *  and is worth showing; everything else is "unavailable". */
export function mapError(err: unknown): Response {
  if (err instanceof TicketApiError && err.status === 400) return fail(err.message, 400);
  return fail("ticket service unavailable", 502);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const CODE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export function parseEventCode(raw: unknown): string | null {
  return typeof raw === "string" && CODE_RE.test(raw) ? raw : null;
}

/** Where CowTicket's ticket page links back to: our event page, on whatever
 *  origin this function was reached through (preview or production). */
export function returnUrlFor(request: Request, slug: unknown): string | null {
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return null;
  return `${new URL(request.url).origin}/event/${slug}`;
}

function stringRecord(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") return null;
    if (k.length > 64 || v.length > 500) return null;
    out[k] = v.trim();
  }
  return out;
}

/** Purchase-form answers: a flat object of short strings. Blank answers are
 *  dropped so an optional field never arrives as "". */
export function parseAnswers(raw: unknown): Record<string, string> | null {
  const rec = stringRecord(raw ?? {});
  if (!rec) return null;
  return Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== ""));
}

const PASS_KEYS: (keyof PassDisplay)[] = [
  "main",
  "description",
  "head",
  "date",
  "dateDisplay",
  "principal",
  "zone",
  "seat",
];

function parsePassDisplay(raw: unknown): PassDisplay | undefined | null {
  if (raw === undefined) return undefined;
  const rec = stringRecord(raw);
  if (!rec) return null;
  const out: PassDisplay = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!PASS_KEYS.includes(k as keyof PassDisplay)) return null;
    if (v) out[k as keyof PassDisplay] = v;
  }
  return out;
}

const MAX_ITEMS = 20;
const MAX_QTY = 50;

/** Shape-checks the platform order items the browser assembled. Codes,
 *  ranges and stock are CowTicket's to judge; this only refuses what could
 *  never be a valid request, so a malformed body is a 400 here rather than a
 *  confusing 400 from upstream. `allowUnits` is false on the chat path. */
export function parseItems(raw: unknown, { allowUnits }: { allowUnits: boolean }): OrderItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return null;
  const items: OrderItemInput[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") return null;
    const { code, quantity, addOns, units, passDisplay } = it as Record<string, unknown>;
    if (typeof code !== "string" || !CODE_RE.test(code)) return null;
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QTY) {
      return null;
    }
    const item: OrderItemInput = { code, quantity: quantity as number };

    if (addOns !== undefined) {
      if (!Array.isArray(addOns)) return null;
      item.addOns = [];
      for (const a of addOns) {
        const { code: ac, qty } = (a ?? {}) as Record<string, unknown>;
        if (typeof ac !== "string" || !CODE_RE.test(ac)) return null;
        if (!Number.isInteger(qty) || (qty as number) < 0 || (qty as number) > MAX_QTY) return null;
        item.addOns.push({ code: ac, qty: qty as number });
      }
    }

    if (units !== undefined) {
      if (!allowUnits || !Array.isArray(units) || units.length !== item.quantity) return null;
      item.units = [];
      for (const u of units) {
        const groups = (u as { addOns?: unknown })?.addOns;
        if (!groups || typeof groups !== "object" || Array.isArray(groups)) return null;
        const parsed: Record<string, Record<string, string>[]> = {};
        for (const [ac, list] of Object.entries(groups as Record<string, unknown>)) {
          if (!CODE_RE.test(ac) || !Array.isArray(list)) return null;
          const recs: Record<string, string>[] = [];
          for (const rec of list) {
            const r = stringRecord(rec);
            if (!r) return null;
            recs.push(r);
          }
          parsed[ac] = recs;
        }
        item.units.push({ addOns: parsed });
      }
    }

    const pd = parsePassDisplay(passDisplay);
    if (pd === null) return null;
    if (pd) item.passDisplay = pd;

    items.push(item);
  }
  return items;
}

/** Theme is optional and sanitized again by the ticket client; here we only
 *  make sure it is an object of strings so the sanitizer sees what it expects. */
export function parseTheme(raw: unknown): OrderTheme | undefined {
  if (raw === undefined || raw === null) return undefined;
  const rec = stringRecord(raw);
  if (!rec) return undefined;
  return { primaryColor: rec.primaryColor, secondaryColor: rec.secondaryColor };
}
