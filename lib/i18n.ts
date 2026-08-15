import type { Localized } from "@/types/content";
import uiStrings from "@/content/ui.json";

export type Locale = "th" | "en";
export const DEFAULT_LOCALE: Locale = "th";
export const LOCALES: Locale[] = ["th", "en"];

/** Resolve a bilingual value for the active locale. */
export function pick(value: Localized, locale: Locale = DEFAULT_LOCALE): string {
  return value[locale];
}

type UiKey = keyof typeof uiStrings;

/** Look up a chrome/UI string from content/ui.json — no hardcoded copy in components. */
export function t(key: UiKey, locale: Locale = DEFAULT_LOCALE): string {
  return (uiStrings[key] as Localized)[locale];
}

/** Short weekday label only, e.g. "ส." / "Sat". */
export function formatWeekday(isoDate: string, locale: Locale = DEFAULT_LOCALE): string {
  const intlLocale = locale === "th" ? "th-TH" : "en-GB";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(intlLocale, { weekday: "short" });
}

/** Short month label only, e.g. "ส.ค." / "Aug". */
export function formatMonth(isoDate: string, locale: Locale = DEFAULT_LOCALE): string {
  const intlLocale = locale === "th" ? "th-TH" : "en-GB";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(intlLocale, { month: "short" });
}

/** The festival's timezone. Session fields from the ticket platform are
 *  instants, so they must be formatted pinned to this — a reader in another
 *  zone would otherwise see a 10:00 session as 03:00. */
const FESTIVAL_TZ = "Asia/Bangkok";

/** Session time range, e.g. "10:00–10:30". `endAt` may be null (open-ended). */
export function formatTimeRange(
  startAt: string,
  endAt: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const intlLocale = locale === "th" ? "th-TH" : "en-GB";
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: FESTIVAL_TZ,
    });
  return endAt ? `${time(startAt)}–${time(endAt)}` : time(startAt);
}

/** Locale-aware date formatting for schedules. */
export function formatDate(isoDate: string, locale: Locale = DEFAULT_LOCALE): string {
  const intlLocale = locale === "th" ? "th-TH" : "en-GB";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
