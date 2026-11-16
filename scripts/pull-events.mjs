#!/usr/bin/env node
/**
 * Pull event content from CowTicket into content/events/*.json.
 *
 *   node --env-file=.env.local scripts/pull-events.mjs            # show what would change
 *   node --env-file=.env.local scripts/pull-events.mjs --write    # write files
 *   ... --only=big-giant,witch-kitchen                            # some slugs
 *   ... --include-unpublished                                     # also new events not published yet
 *
 * The organizer edits events on CowTicket (in the LINE app, or by asking its
 * chat assistant). This turns the result back into the JSON the site builds
 * from; `git diff` is the review, and a push deploys it. Nothing is written
 * to CowTicket — every call here is a read.
 *
 * It MERGES into each file rather than regenerating it:
 *   from CowTicket  title, description, presenter, room, sessions (time, room,
 *                   ticket code), price, capacity, the site fields (SITE_KEYS)
 *                   and the cover picture
 *   kept from JSON  slug, mascot, image alt text — the site's own, with no
 *                   field on CowTicket
 * A required field that is empty on CowTicket keeps its JSON value and is
 * reported; an event whose page was never filled in is left alone.
 *
 * A new event (no JSON yet) is created once its page is PUBLISHED and has
 * everything a page needs; until then it is listed with what is missing.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { API, api, printTable, q, short } from "./cowticket-api.mjs";

const WRITE = process.argv.includes("--write");
const INCLUDE_UNPUBLISHED = process.argv.includes("--include-unpublished");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);

const EVENTS_DIR = join("content", "events");
const POSTER_SRC_DIR = join("image-src", "content", "events");
const MASCOT_SRC_DIR = join("image-src", "content", "mascots");
/** sha256 of the cover last pulled for each slug. The API hands out a signed
 *  link, not a version, so this is how the next run knows a poster changed. */
const COVER_STATE_FILE = join("content", "cover-hashes.json");

/** Same convention as sync-tickets: codes are year-prefixed on the platform;
 *  the site's slug is the code without the prefix. */
const EVENT_CODE_PREFIX = "cbf2026-";
/** sync-tickets pushed this quantity for a paid event with no stated capacity;
 *  reading it back must not invent a "100 seats" line on the page. */
const DEFAULT_PAID_QUANTITY = 100;

/** Event-level site fields → JSON keys. `required` ones keep their JSON value
 *  when CowTicket has none; optional ones follow CowTicket, removal included. */
const SITE_KEYS = [
  { key: "summary", required: true },
  { key: "category", required: true },
  { key: "ageRange", required: true },
  { key: "admission", required: true },
  { key: "admissionNote", required: false },
  { key: "capacityLabel", required: false },
];

/** Key order of an event file — the order the existing ones were written in. */
const KEY_ORDER = [
  "slug", "thumbnail", "mascot", "title", "summary", "presenter", "description", "category",
  "schedule", "ageRange", "price", "capacity", "capacityLabel", "gallery", "ticketEventCode",
  "admission", "admissionNote",
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** An instant as Thailand wall-clock parts (the site's sessions are local). */
function bangkok(iso) {
  const local = new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const coverPath = (slug) => `/content/events/${slug}.jpeg`;

/** A stable pick from the mascot cut-outs, so a new event gets one without
 *  anyone choosing and keeps it on every later run. */
function mascotFor(slug) {
  const names = readdirSync(MASCOT_SRC_DIR).filter((f) => f.endsWith(".png")).sort();
  const n = parseInt(sha256(slug).slice(0, 8), 16);
  return `/content/mascots/${names[n % names.length]}`;
}

const rows = [];
const warnings = [];
const plan = (slug, field, change) => rows.push({ event: slug, field, change });

// ── Building one event from CowTicket ──────────────────────────────────────

/** Sessions from the ticket types. HIDDEN types are retired sessions (that is
 *  what sync-tickets did with them) and are left out — except one the JSON
 *  still lists, which is kept and reported: hiding is also how an organizer
 *  pauses sales, and that must not silently drop a session from the schedule. */
function sessionsFrom(configs, local, defaultVenue, slug) {
  const localCodes = new Set(local?.schedule.sessions.flatMap((s) => s.ticketCodes ?? []) ?? []);
  const sessions = [];
  for (const c of configs) {
    if (!c.sessionStartAt || !c.sessionEndAt) continue;
    if (c.status !== "ACTIVE") {
      if (!localCodes.has(c.code)) continue;
      warnings.push(`${slug}: session ${c.code} is hidden on CowTicket — kept; remove it by hand if it was cancelled`);
    }
    const start = bangkok(c.sessionStartAt);
    const end = bangkok(c.sessionEndAt);
    sessions.push({
      date: start.date,
      start: start.time,
      end: end.time,
      ...(c.venueName && c.venueName !== defaultVenue ? { venue: c.venueName } : {}),
      ticketCodes: [c.code],
    });
  }
  return sessions.sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

/** The one value the JSON holds for something CowTicket keeps per session. */
function sharedValue(configs, field, slug) {
  const values = [...new Set(configs.map((c) => c[field]))];
  if (values.length > 1) {
    warnings.push(`${slug}: sessions have different ${field} (${values.join(", ")}) — the site shows one; used the first`);
  }
  return values[0];
}

/** Returns the merged event, or null (with a warning) when it cannot be built. */
function buildEvent({ remote, page, configs, local, slug }) {
  const next = local ? structuredClone(local) : { slug };
  const missing = [];
  const set = (key, value) => {
    next[key] = value;
  };
  /** Required: CowTicket's value, else what the JSON has, else it is missing. */
  const require = (key, value) => {
    if (value !== null && value !== undefined && value !== "") set(key, value);
    else if (next[key] === undefined) missing.push(key);
    else warnings.push(`${slug}: "${key}" is empty on CowTicket — kept the JSON value`);
  };
  /** Optional: follows CowTicket, including removal. */
  const optional = (key, value) => {
    if (value !== null && value !== undefined && value !== "") set(key, value);
    else delete next[key];
  };

  set("title", remote.name);
  set("ticketEventCode", remote.eventCode);

  // The page. One that was never filled in (no description) says nothing about
  // the event yet, so its empty fields must not wipe what the JSON has.
  const seeded = Boolean(page?.description);
  if (seeded) {
    require("description", page.description);
    optional("presenter", page.organizerName);
    for (const { key, required } of SITE_KEYS) {
      (required ? require : optional)(key, page.siteValues?.[key]);
    }
  } else if (local) {
    warnings.push(`${slug}: page not filled in on CowTicket yet — page content kept from JSON`);
  } else {
    missing.push("page content");
  }

  // Schedule, price and capacity come from the ticket types.
  const defaultVenue = (seeded && page.venueName) || local?.schedule.venue;
  if (!defaultVenue) missing.push("room (venueName)");
  const sessions = sessionsFrom(configs, local, defaultVenue, slug);
  if (sessions.length) {
    set("schedule", { venue: defaultVenue, sessions });
    const live = configs.filter((c) => sessions.some((s) => s.ticketCodes[0] === c.code));
    set("price", sharedValue(live, "price", slug) / 100);
    const quantity = sharedValue(live, "quantity", slug);
    const isSyncDefault = local?.capacity === undefined && quantity === DEFAULT_PAID_QUANTITY;
    // 0 is CowTicket's "unlimited", which the site states by saying nothing.
    if (quantity > 0 && !isSyncDefault) set("capacity", quantity);
    else delete next.capacity;
  } else if (local) {
    warnings.push(`${slug}: no dated ticket types on CowTicket — schedule kept from JSON`);
  } else {
    missing.push("sessions");
  }

  // Site-owned fields, filled once for a new event.
  if (!next.mascot) set("mascot", mascotFor(slug));
  if (!next.thumbnail) set("thumbnail", coverPath(slug));
  if (!next.gallery?.length) set("gallery", [{ src: next.thumbnail, alt: next.title }]);
  if (!local && !page?.coverImageUrl) missing.push("cover picture");

  if (missing.length) {
    warnings.push(`${slug}: not created — missing ${missing.join(", ")}`);
    return null;
  }
  // Conventional key order (every existing file already follows it), so a
  // field that appears later lands in its usual place and diffs stay small.
  // A key this script does not know is kept, after the known ones.
  const keys = [...KEY_ORDER, ...Object.keys(next).filter((k) => !KEY_ORDER.includes(k))];
  return Object.fromEntries(keys.filter((k) => next[k] !== undefined).map((k) => [k, next[k]]));
}

/** One row per changed top-level field. */
function report(slug, before, after) {
  for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(after)])) {
    const a = JSON.stringify(before?.[key]);
    const b = JSON.stringify(after[key]);
    if (a === b) continue;
    const complex = typeof (after[key] ?? before?.[key]) === "object";
    plan(slug, key, complex ? "changed" : `${short(before?.[key])} → ${short(after[key])}`);
  }
}

// ── Cover pictures ─────────────────────────────────────────────────────────

/** Returns true when a new poster was saved (so images need re-rendering). */
async function pullCover(slug, event, page, coverState) {
  if (!page?.coverImageUrl) return false;
  const res = await fetch(page.coverImageUrl);
  if (!res.ok) {
    warnings.push(`${slug}: cover download failed (${res.status})`);
    return false;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const hash = sha256(bytes);
  if (coverState[slug] === hash) return false;

  // First sight of this cover. If it is the very file migrate-pages uploaded
  // (our own 1600px render), there is nothing new — just remember it.
  const rendered = join("public", event.thumbnail.replace(/\.(png|jpe?g)$/i, "-1600.webp"));
  const ours = existsSync(rendered) && sha256(readFileSync(rendered)) === hash;
  if (!ours) {
    plan(slug, "cover", `new poster (${Math.round(bytes.length / 1024)} KB)`);
    if (WRITE) {
      // The image pipeline reads JPEG/PNG sources; CowTicket may hold WebP.
      const { default: sharp } = await import("sharp");
      mkdirSync(POSTER_SRC_DIR, { recursive: true });
      const file = join(POSTER_SRC_DIR, `${slug}.jpeg`);
      await sharp(bytes).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toFile(file);
    }
  }
  if (WRITE) coverState[slug] = hash;
  return !ours;
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log(`${WRITE ? "" : "DRY RUN — "}pulling events from ${API}`);

const locals = new Map(
  readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(EVENTS_DIR, f)))
    .map((e) => [e.ticketEventCode, e]),
);

const listed = await api(`/events?${q({ take: "200" })}`);
const remoteByCode = new Map(listed.data.map((e) => [e.eventCode, e]));

// The festival's workspace: the one our existing events sit in. Anything else
// on the account (another project, a test) is not this site's business.
const workspaceIds = new Set(
  [...locals.keys()].map((code) => remoteByCode.get(code)?.workspace?.id).filter(Boolean),
);
if (process.env.TICKET_WORKSPACE_ID) {
  workspaceIds.clear();
  workspaceIds.add(process.env.TICKET_WORKSPACE_ID);
}
if (workspaceIds.size !== 1) {
  console.error(`Can't tell which workspace is the festival's (${[...workspaceIds].join(", ") || "none"}). Set TICKET_WORKSPACE_ID.`);
  process.exit(1);
}
const [workspaceId] = workspaceIds;

for (const [code, local] of locals) {
  if (!remoteByCode.has(code)) warnings.push(`${local.slug}: no event ${code} on CowTicket — JSON left as is`);
}

const coverState = existsSync(COVER_STATE_FILE) ? readJson(COVER_STATE_FILE) : {};
const coverStateBefore = JSON.stringify(coverState);
let written = 0;
let newPosters = 0;
let unchanged = 0;
const failures = [];

const remotes = listed.data
  .filter((e) => e.workspace?.id === workspaceId)
  .sort((a, b) => a.eventCode.localeCompare(b.eventCode));

for (const remote of remotes) {
  const local = locals.get(remote.eventCode);
  const slug = local?.slug ?? remote.eventCode.replace(EVENT_CODE_PREFIX, "");
  if (ONLY && !ONLY.includes(slug)) continue;
  // A new event appears on the site only once its page is published.
  if (!local && !remote.page?.published && !INCLUDE_UNPUBLISHED) {
    warnings.push(`${slug}: new on CowTicket ("${remote.name}") but its page is not published — skipped`);
    continue;
  }
  const before = rows.length;
  try {
    const [{ page }, { data: configs }] = await Promise.all([
      api(`/events/page?${q({ eventCode: remote.eventCode })}`),
      api(`/ticketConfigs?${q({ eventCode: remote.eventCode })}`),
    ]);
    const next = buildEvent({ remote, page, configs, local, slug });
    if (!next) continue;
    report(slug, local, next);
    if (!local) plan(slug, "(file)", "new event");
    if (WRITE && JSON.stringify(local) !== JSON.stringify(next)) {
      writeFileSync(join(EVENTS_DIR, `${slug}.json`), `${JSON.stringify(next, null, 2)}\n`);
      written++;
    }
    if (await pullCover(slug, next, page, coverState)) newPosters++;
  } catch (err) {
    failures.push(`${slug}: ${err.message}`);
    plan(slug, "FAILED", err.message);
  }
  if (rows.length === before) unchanged++;
}

if (WRITE && JSON.stringify(coverState) !== coverStateBefore) {
  const sorted = Object.fromEntries(Object.entries(coverState).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(COVER_STATE_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

console.log("");
if (rows.length) {
  console.log(WRITE ? "Changes written:" : "Changes found (dry run — nothing written; add --write):");
  printTable(rows, ["event", "field", "change"]);
} else {
  console.log("No changes.");
}
console.log(`${unchanged} event(s) unchanged${WRITE ? `, ${written} file(s) written` : ""}.`);
for (const w of warnings) console.log(`⚠ ${w}`);

if (WRITE && newPosters) {
  console.log(`\n${newPosters} new poster(s) — rendering images…`);
  const result = spawnSync(process.execPath, ["scripts/optimize-images.mjs"], { stdio: "inherit" });
  if (result.status !== 0) failures.push("image rendering failed — run `pnpm images`");
}

console.log(`\n${failures.length ? `${failures.length} failure(s):` : "done, no failures"}`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
