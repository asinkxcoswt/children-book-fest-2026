import uiStrings from "@/content/ui.json";

/** The site is Thai-only. Dates and times are formatted for th-TH, pinned to
 *  the festival's timezone. */
const INTL = "th-TH";

type UiKey = keyof typeof uiStrings;

/** Look up a chrome/UI string from content/ui.json — no hardcoded copy in components. */
export function t(key: UiKey): string {
  return uiStrings[key];
}

/** Short weekday label only, e.g. "ส.". */
export function formatWeekday(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(INTL, { weekday: "short" });
}

/** Short month label only, e.g. "ส.ค.". */
export function formatMonth(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(INTL, { month: "short" });
}

/** The festival's timezone. Session fields from the ticket platform are
 *  instants, so they must be formatted pinned to this — a reader in another
 *  zone would otherwise see a 10:00 session as 03:00. */
const FESTIVAL_TZ = "Asia/Bangkok";

/** The calendar day an instant falls on in Bangkok, as YYYY-MM-DD. */
function festivalDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: FESTIVAL_TZ });
}

/** Session time range, e.g. "10:00–10:30". `endAt` may be null (open-ended).
 *  A session that ends on a later day carries that day inline — "23:00 – อ. 8
 *  ธ.ค. 01:00" — because a bare "23:00–01:00" reads as ending the same evening
 *  and sends the buyer to the gate on the wrong day. */
export function formatTimeRange(startAt: string, endAt: string | null): string {
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(INTL, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: FESTIVAL_TZ,
    });
  if (!endAt) return time(startAt);
  const endDay = festivalDay(endAt);
  if (endDay === festivalDay(startAt)) return `${time(startAt)}–${time(endAt)}`;
  return `${time(startAt)} – ${formatDate(endDay)} ${time(endAt)}`;
}

/** Date formatting for schedules, e.g. "ส. 28 พ.ย.". */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(INTL, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
