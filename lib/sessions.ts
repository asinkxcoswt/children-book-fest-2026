/** Pure helpers over one event's schedule. No file access, so they are safe in
 *  Client Components (the preview page renders an event in the browser).
 *  lib/content.ts re-exports them for server code. */
import type { EventSession, FestivalEvent } from "@/types/content";

/** The earliest occurrence — what listings and sort order key on. */
export function firstSession(event: FestivalEvent): EventSession {
  return event.schedule.sessions[0];
}

/** The room a session is held in: its own `venue` when set, else the event's
 *  default. Always read venues through this so overrides are never missed. */
export function sessionVenue(event: FestivalEvent, session: EventSession): string {
  return session.venue ?? event.schedule.venue;
}

/** Whether any session is held somewhere other than the event's default room —
 *  the cue for displays to spell out the room per date. */
export function hasSessionVenues(event: FestivalEvent): boolean {
  return event.schedule.sessions.some((s) => s.venue !== undefined);
}

/** Sessions grouped by date (and room, when a day's sessions are split across
 *  rooms), preserving chronological order — for "When" displays where two
 *  same-day time slots read as one line. */
export function getSessionsByDate(
  event: FestivalEvent,
): { date: string; venue: string; sessions: EventSession[] }[] {
  const groups: { date: string; venue: string; sessions: EventSession[] }[] = [];
  for (const s of event.schedule.sessions) {
    const venue = sessionVenue(event, s);
    const last = groups[groups.length - 1];
    if (last?.date === s.date && last.venue === venue) last.sessions.push(s);
    else groups.push({ date: s.date, venue, sessions: [s] });
  }
  return groups;
}
