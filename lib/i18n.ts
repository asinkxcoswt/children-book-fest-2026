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

/** Locale-aware date formatting for schedules. */
export function formatDate(isoDate: string, locale: Locale = DEFAULT_LOCALE): string {
  const intlLocale = locale === "th" ? "th-TH" : "en-GB";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
