#!/usr/bin/env node
/**
 * Push event content into CowTicket's management API.
 *
 *   pnpm sync:tickets -- --dry-run     # show the plan, write nothing
 *   pnpm sync:tickets                  # reconcile for real
 *
 * Reconcile, not replay: list what exists, create what's missing, update what
 * differs, hide what we retired. Safe to re-run. CowTicket stays the source of
 * truth for money and inventory counters — we only push content-side fields.
 *
 * Needs an ADMIN-type key carrying the "events:manage" scope; a customer key
 * is rejected outright. Server-side only — never import this from the app.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const API = requireEnv("TICKET_API_URL");
const ACCOUNT_ID = requireEnv("TICKET_ACCOUNT_ID");
const ADMIN_KEY = requireEnv("TICKET_ADMIN_API_KEY");

const DRY_RUN = process.argv.includes("--dry-run");

/** Content-side conventions. One ticket config per session; its code is
 *  <yyyymmdd>-<hhmm> and matches schedule.sessions[].ticketCodes in
 *  content/events/*.json. Prices are in satang (1000 = ฿10). */
const TAG = "children-book-fest-2026";
/** Every event sells one ticket type, and the session it admits to now lives in
 *  sessionStartAt — so the name no longer carries the time. Its real audience is
 *  the organizer's portal, the participant export, the Stripe line item and the
 *  issued ticket, where it is read with no event page around it. */
const TICKET_NAME = "บัตรเข้าร่วม 1 ที่นั่ง";
const PRICE = 1000; // satang = ฿10
const LIMIT_PER_ORDER = 4;
const DEFAULT_QUANTITY = 200;
/** One deliberately tiny event so the sold-out path is visible on the site. */
const QUANTITY_BY_SLUG = { "how-stories-grow": 1 };
const REFUND = {
  refundAllowed: false,
  refundTermTh: "บัตรที่ซื้อแล้วไม่สามารถขอคืนเงินได้",
  refundTermEn: "All sales are final. Tickets are non-refundable.",
};
/** Year-prefixed: codes are permanent and unique per account, so the 2027
 *  edition must not collide with this one on the same account. */
const eventCodeFor = (slug) => `cbf2026-${slug}`;

/** Session times in content are Thailand local wall-clock. */
const TH_OFFSET = "+07:00";

const nextDay = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Content models a session as ONE date plus wall-clock start/end, so it cannot
 *  express an overnight session directly: an end that sorts before its start
 *  can only mean the session runs past midnight. Roll the end onto the next day
 *  rather than pushing an end that precedes its own start. */
function sessionRange(s) {
  const endDate = s.end < s.start ? nextDay(s.date) : s.date;
  return {
    sessionStartAt: `${s.date}T${s.start}:00${TH_OFFSET}`,
    sessionEndAt: `${endDate}T${s.end}:00${TH_OFFSET}`,
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Run via "pnpm sync:tickets" so .env.local is loaded.`);
    process.exit(1);
  }
  return value;
}

// ── API plumbing ───────────────────────────────────────────────────────────

let token = null;
async function getToken() {
  if (token) return token;
  const res = await fetch(`${API}/accounts/token`, {
    method: "POST",
    headers: { "api-key": ADMIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: ACCOUNT_ID, type: "admin" }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  token = (await res.json()).token;
  return token;
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify({ accountId: ACCOUNT_ID, ...body }) : undefined,
  });
  // State-change refusals arrive as 500 with the real reason in the body.
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${(await res.text()).trim()}`);
  return res.json();
}

// ── Desired state, derived from content/events/*.json ──────────────────────

function loadEvents() {
  const dir = join(process.cwd(), "content", "events");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .sort((a, b) => firstKey(a).localeCompare(firstKey(b)));
}
const firstKey = (e) => `${e.schedule.sessions[0].date}${e.schedule.sessions[0].start}`;

function desiredConfigs(event) {
  // Chronological: the API has no sort field, so creation order IS display order.
  return event.schedule.sessions.map((s) => ({
    code: s.ticketCodes[0],
    name: TICKET_NAME,
    // The session is what admits you, and the platform now models it directly.
    // Do NOT put the date back into `group` — that field is for non-time
    // sections (zone, tier, package), which the storefront renders as the
    // section heading now that the day sits on the ticket itself.
    ...sessionRange(s),
    group: null,
    price: PRICE,
    quantity: QUANTITY_BY_SLUG[event.slug] ?? DEFAULT_QUANTITY,
    limitPerOrder: LIMIT_PER_ORDER,
    startSellingDate: null,
    endSellingDate: null,
    status: "ACTIVE",
  }));
}

/** Fields we own. Anything not listed here is left to the organizer's app. */
const EVENT_FIELDS = ["name", "refundAllowed", "refundTermTh", "refundTermEn"];
const CONFIG_FIELDS = ["name", "group", "price", "quantity", "limitPerOrder", "status",
                       "startSellingDate", "endSellingDate", "sessionStartAt", "sessionEndAt"];

/** Timestamps: compared as instants, never as strings. We send +07:00 and the
 *  platform echoes UTC, so a string compare would report a diff on every run
 *  and re-PUT the same value forever. */
const INSTANT_FIELDS = new Set(["startSellingDate", "endSellingDate",
                                "sessionStartAt", "sessionEndAt"]);

function same(field, a, b) {
  if (a === null || b === null) return a === b;
  if (INSTANT_FIELDS.has(field)) return Date.parse(a) === Date.parse(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

function diff(current, desired, fields) {
  const changed = {};
  for (const f of fields) {
    const a = current[f] ?? null;
    const b = desired[f] ?? null;
    if (!same(f, a, b)) changed[f] = b;
  }
  return changed;
}

// ── Reconcile ──────────────────────────────────────────────────────────────

const log = (...args) => console.log(...args);
const plan = (verb, what) => log(`  ${DRY_RUN ? "would " : ""}${verb} ${what}`);
const failures = [];

async function listEvents() {
  const [active, archived] = await Promise.all([
    api(`/events?accountId=${encodeURIComponent(ACCOUNT_ID)}&take=200`),
    api(`/events?accountId=${encodeURIComponent(ACCOUNT_ID)}&archived=true&take=200`),
  ]);
  const byCode = new Map();
  for (const e of [...active.data, ...archived.data]) byCode.set(e.eventCode, e);
  return byCode;
}

async function syncEvent(event, existingEvents) {
  const eventCode = eventCodeFor(event.slug);
  const desired = { name: event.title.th, tags: [TAG], ...REFUND };
  const current = existingEvents.get(eventCode);

  log(`\n${eventCode}  (${event.title.th})`);

  if (!current) {
    plan("create", "event");
    if (!DRY_RUN) await api("/events", { method: "POST", body: { eventCode, ...desired } });
  } else {
    if (current.archivedAt) {
      plan("unarchive", "event");
      if (!DRY_RUN) await api("/events/archive", { method: "POST", body: { eventCode, archived: false } });
    }
    const changed = diff(current, desired, EVENT_FIELDS);
    const tagsChanged = JSON.stringify(current.tags ?? []) !== JSON.stringify([TAG]);
    if (tagsChanged) changed.tags = [TAG];
    if (Object.keys(changed).length) {
      plan("update", `event: ${Object.keys(changed).join(", ")}`);
      if (!DRY_RUN) await api("/events", { method: "PUT", body: { eventCode, ...changed } });
    } else {
      log("  event up to date");
    }
  }

  // Ticket options. A brand-new event has none yet; in a dry run it may not exist.
  const existing = new Map();
  if (current || !DRY_RUN) {
    const res = await api(
      `/ticketConfigs?accountId=${encodeURIComponent(ACCOUNT_ID)}&eventCode=${encodeURIComponent(eventCode)}`,
    );
    for (const c of res.data) existing.set(c.code, c);
  }

  const wanted = desiredConfigs(event);
  for (const want of wanted) {
    const have = existing.get(want.code);
    try {
      if (!have) {
        plan("create", `ticket ${want.code}  ${want.sessionStartAt} ${want.name}  qty ${want.quantity}`);
        if (!DRY_RUN) await api("/ticketConfigs", { method: "POST", body: { eventCode, ...want } });
      } else {
        const changed = diff(have, want, CONFIG_FIELDS);
        if (Object.keys(changed).length) {
          plan("update", `ticket ${want.code}: ${Object.keys(changed).join(", ")}`);
          if (!DRY_RUN) await api("/ticketConfigs", { method: "PUT", body: { id: have.id, ...changed } });
        }
      }
    } catch (err) {
      failures.push(`${eventCode}/${want.code}: ${err.message}`);
      console.error(`  FAILED ${want.code}: ${err.message}`);
    }
  }

  // Anything on the platform we no longer have content for: take off sale,
  // never delete — it may carry orders.
  for (const [code, config] of existing) {
    if (wanted.some((w) => w.code === code) || config.status === "HIDDEN") continue;
    plan("hide", `orphaned ticket ${code} (no longer in content)`);
    if (!DRY_RUN) await api("/ticketConfigs", { method: "PUT", body: { id: config.id, status: "HIDDEN" } });
  }
}

const events = loadEvents();
log(`${DRY_RUN ? "DRY RUN — " : ""}syncing ${events.length} events to ${API}`);
const existingEvents = await listEvents();
log(`${existingEvents.size} event(s) already on the account`);

for (const event of events) {
  try {
    await syncEvent(event, existingEvents);
  } catch (err) {
    failures.push(`${event.slug}: ${err.message}`);
    console.error(`  FAILED: ${err.message}`);
  }
}

log(`\n${failures.length ? `${failures.length} failure(s):` : "done, no failures"}`);
for (const f of failures) log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
