import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Category, EventSession, FestivalEvent } from "@/types/content";
import categoriesData from "@/content/categories.json";

const categories = categoriesData as Category[];

const EVENTS_DIR = join(process.cwd(), "content", "events");

/** Read every event JSON file once, at module load (server-only). */
const events: FestivalEvent[] = readdirSync(EVENTS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(EVENTS_DIR, file), "utf8")) as FestivalEvent)
  .sort((a, b) => sessionKey(firstSession(a)).localeCompare(sessionKey(firstSession(b))));

function sessionKey(s: EventSession): string {
  return `${s.date}${s.start}`;
}

export function getCategories(): Category[] {
  return categories;
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getEvents(): FestivalEvent[] {
  return events;
}

export function getEvent(slug: string): FestivalEvent | undefined {
  return events.find((e) => e.slug === slug);
}

export function getEventsByCategory(categorySlug: string): FestivalEvent[] {
  return events.filter((e) => e.category === categorySlug);
}

/** The earliest occurrence — what listings and sort order key on. */
export function firstSession(event: FestivalEvent): EventSession {
  return event.schedule.sessions[0];
}

/** Sessions grouped by date, preserving chronological order — for "When"
 *  displays where two same-day time slots read as one line. */
export function getSessionsByDate(event: FestivalEvent): { date: string; sessions: EventSession[] }[] {
  const groups: { date: string; sessions: EventSession[] }[] = [];
  for (const s of event.schedule.sessions) {
    const last = groups[groups.length - 1];
    if (last?.date === s.date) last.sessions.push(s);
    else groups.push({ date: s.date, sessions: [s] });
  }
  return groups;
}

/** The festival's fixed run (inclusive ISO dates). Keep in sync with the
 *  editorial hero dates in content/ui.json. */
export const FESTIVAL_START = "2026-11-28";
export const FESTIVAL_END = "2026-12-13";

/** Every date the festival runs on, in order — the fixed run above, not the
 *  dates events happen to be scheduled on, so the schedule board and per-card
 *  day strips keep their full width while the programme is still filling in. */
export function getFestivalDates(): string[] {
  const dates: string[] = [];
  const d = new Date(`${FESTIVAL_START}T00:00:00Z`);
  const end = new Date(`${FESTIVAL_END}T00:00:00Z`);
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
  return dates;
}

/** Count of events per category slug — handy for category tiles. */
export function getEventCount(categorySlug: string): number {
  return events.filter((e) => e.category === categorySlug).length;
}
