#!/usr/bin/env node
/**
 * One-off migration: seed CowTicket's event pages from content/events/*.json,
 * so the organizer (and CowTicket's chat assistant) has the current content to
 * edit. After this, content flows the other way — CowTicket → this repo.
 *
 *   node --env-file=.env.dev scripts/migrate-pages.mjs            # dry run
 *   node --env-file=.env.dev scripts/migrate-pages.mjs --apply    # write
 *   ... --only=big-giant,witch-kitchen                            # some slugs
 *   ... --force-images                                            # re-upload covers
 *
 * Reconcile, not replay: read each page, send only what differs. Safe to
 * re-run. It never creates an event, never publishes or unpublishes a page,
 * and never clears a value that exists only on CowTicket.
 *
 * What moves:  description, room, the venue's address and map link, first/last session
 *              time, presenter (as the page's organizer name), cover picture,
 *              the project's site
 *              fields (SITE_KEYS below), per-session rooms.
 * What stays:  mascot and image alt text (site design, no field on CowTicket);
 *              title, sessions, price, capacity, add-ons are already there.
 *
 * Needs the same three variables as sync-tickets (TICKET_API_URL,
 * TICKET_ACCOUNT_ID, TICKET_ADMIN_API_KEY). Server-side only.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { API, api, printTable, q, short } from "./cowticket-api.mjs";

const APPLY = process.argv.includes("--apply");
const FORCE_IMAGES = process.argv.includes("--force-images");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);

/** Event-level site fields (CowTicket: ฉัน → เว็บไซต์ของโปรเจค) and where each
 *  comes from in our JSON. A key the project does not define is refused by the
 *  API, so the script checks the definitions first. */
const SITE_KEYS = {
  summary: (e) => e.summary,
  category: (e) => e.category,
  ageRange: (e) => e.ageRange,
  admission: (e) => e.admission,
  admissionNote: (e) => e.admissionNote,
  capacityLabel: (e) => e.capacityLabel,
};

/** Session times in content are Thailand local wall-clock. */
const TH_OFFSET = "+07:00";
const nextDay = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const sessionStart = (s) => `${s.date}T${s.start}:00${TH_OFFSET}`;
/** An end that sorts before its start runs past midnight (see sync-tickets). */
const sessionEnd = (s) => `${s.end < s.start ? nextDay(s.date) : s.date}T${s.end}:00${TH_OFFSET}`;

/** The cover is the pre-rendered 1600px WebP, not the multi-megabyte source:
 *  the API caps a picture at 2.5 MB and 1600px is the largest the site uses. */
const coverFileFor = (event) => join("public", event.thumbnail.replace(/\.(png|jpe?g)$/i, "-1600.webp"));

// ── Desired state, from content ────────────────────────────────────────────

const VENUE = JSON.parse(readFileSync(join(process.cwd(), "content", "venue.json"), "utf8"));

function loadEvents() {
  const dir = join(process.cwd(), "content", "events");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .filter((e) => !ONLY || ONLY.includes(e.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function desiredPage(event) {
  const sessions = event.schedule.sessions;
  return {
    description: event.description,
    venueName: event.schedule.venue,
    // One building for the whole festival, so every event gets the same
    // directions link — the venue's own, from content/venue.json.
    mapUrl: VENUE.mapUrl,
    // Not read by this site (it has content/venue.json); filled in so the
    // CowTicket-hosted page and the organizer's editor are not left blank.
    venueAddress: [VENUE.fullName, VENUE.fullNameEn, VENUE.address].join("\n"),
    startAt: sessionStart(sessions[0]),
    endAt: sessionEnd(sessions[sessions.length - 1]),
    // Who runs it. On CowTicket this is the page's organizer name (null there
    // means "the team's name"), so an event without a presenter sends nothing.
    ...(event.presenter ? { organizerName: event.presenter } : {}),
  };
}

function desiredSiteValues(event, definedKeys) {
  const values = {};
  for (const [key, read] of Object.entries(SITE_KEYS)) {
    const v = read(event);
    // Absent locally = nothing to say; never send null, which would clear a
    // value the organizer has since typed on CowTicket.
    if (definedKeys.has(key) && v !== undefined && v !== null && v !== "") values[key] = v;
  }
  return values;
}

const INSTANT_FIELDS = new Set(["startAt", "endAt"]);
/** Timestamps compare as instants: we send +07:00, the platform echoes UTC. */
const same = (field, a, b) =>
  INSTANT_FIELDS.has(field) && a && b ? Date.parse(a) === Date.parse(b) : (a ?? null) === (b ?? null);

// ── Reconcile ──────────────────────────────────────────────────────────────

const rows = [];
const failures = [];
const skipped = [];
let upToDate = 0;
const plan = (slug, target, changes) => rows.push({ event: slug, target, changes });
async function migrateEvent(event, existingCodes, definedKeys) {
  const eventCode = event.ticketEventCode;
  if (!existingCodes.has(eventCode)) {
    skipped.push(`${event.slug}: no event ${eventCode} on CowTicket (run sync:tickets first)`);
    return;
  }

  const { page } = await api(`/events/page?${q({ eventCode })}`);

  // Page fields + site values, in one PUT.
  const changed = {};
  const notes = [];
  for (const [field, want] of Object.entries(desiredPage(event))) {
    if (!same(field, page?.[field], want)) {
      changed[field] = want;
      notes.push(field);
    }
  }
  const siteChanged = {};
  for (const [key, want] of Object.entries(desiredSiteValues(event, definedKeys))) {
    if (page?.siteValues?.[key] !== want) siteChanged[key] = want;
  }
  if (Object.keys(siteChanged).length) {
    changed.siteValues = siteChanged;
    notes.push(...Object.keys(siteChanged).map((k) => `${k}=${short(siteChanged[k])}`));
  }
  if (notes.length) {
    plan(event.slug, page ? "page" : "page (new)", notes.join(", "));
    if (APPLY) {
      // The organizer name goes in its own request: it has a length limit a
      // long presenter line can exceed, and one refused field refuses the
      // whole PUT — the rest of the page should still land.
      const { organizerName, ...rest } = changed;
      if (Object.keys(rest).length) await api("/events/page", { method: "PUT", body: { eventCode, ...rest } });
      if (organizerName !== undefined) {
        await api("/events/page", { method: "PUT", body: { eventCode, organizerName } });
      }
    }
  }

  // Cover: the API returns a signed link, not the bytes, so "has a cover" is
  // all we can compare. Upload when there is none; --force-images replaces.
  if (!page?.coverImageUrl || FORCE_IMAGES) {
    const file = coverFileFor(event);
    if (!existsSync(file)) {
      failures.push(`${event.slug}: cover file missing: ${file} (run pnpm images)`);
    } else {
      const bytes = readFileSync(file);
      plan(event.slug, "cover", `${file.split("/").pop()} (${Math.round(bytes.length / 1024)} KB)`);
      if (APPLY) {
        await api("/events/page/image", {
          method: "POST",
          body: { eventCode, target: "cover", image: bytes.toString("base64"), contentType: "image/webp" },
        });
      }
    }
  }

  // Per-session rooms: only events where a session overrides the default.
  if (event.schedule.sessions.some((s) => s.venue)) {
    const { data } = await api(`/ticketConfigs?${q({ eventCode })}`);
    const byCode = new Map(data.map((c) => [c.code, c]));
    for (const s of event.schedule.sessions) {
      if (!s.venue) continue;
      const config = byCode.get(s.ticketCodes[0]);
      if (!config) {
        failures.push(`${event.slug}: no ticket type ${s.ticketCodes[0]} for the session room`);
        continue;
      }
      if (config.venueName === s.venue) continue;
      plan(event.slug, s.ticketCodes[0], `venueName=${s.venue}`);
      if (APPLY) await api("/ticketConfigs", { method: "PUT", body: { id: config.id, venueName: s.venue } });
    }
  }
}

const events = loadEvents();
console.log(`${APPLY ? "" : "DRY RUN — "}migrating ${events.length} event page(s) to ${API}`);

const listed = await api(`/events?${q({ take: "200" })}`);
const existing = new Map(listed.data.map((e) => [e.eventCode, e]));

// Site field definitions live on the workspace our events sit in.
const workspaceIds = new Set(
  events.map((e) => existing.get(e.ticketEventCode)?.workspace?.id).filter(Boolean),
);
const definedKeys = new Set();
for (const workspaceId of workspaceIds) {
  const site = await api(`/workspaces/site?${q({ workspaceId })}`);
  for (const f of site.siteFields) if (f.target === "event") definedKeys.add(f.key);
}
const undefinedKeys = Object.keys(SITE_KEYS).filter((k) => !definedKeys.has(k));
if (undefinedKeys.length) {
  console.log(`⚠ site field(s) not defined on the project, skipped: ${undefinedKeys.join(", ")}`);
}

for (const event of events) {
  const before = rows.length + skipped.length;
  try {
    await migrateEvent(event, new Set(existing.keys()), definedKeys);
  } catch (err) {
    failures.push(`${event.slug}: ${err.message}`);
    plan(event.slug, "FAILED", err.message);
  }
  if (rows.length + skipped.length === before) upToDate++;
}

console.log("");
if (rows.length) {
  console.log(APPLY ? "Applied changes:" : "Planned changes (dry run — nothing sent; add --apply to write):");
  printTable(rows, ["event", "target", "changes"]);
} else {
  console.log("No changes.");
}
console.log(`${upToDate} event(s) already up to date.`);
for (const s of skipped) console.log(`⚠ skipped ${s}`);
console.log(`\n${failures.length ? `${failures.length} failure(s):` : "done, no failures"}`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
