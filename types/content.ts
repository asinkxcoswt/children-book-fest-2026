/** Shared content model for the festival microsite.
 *  Events and categories are editable data (see content/), never hardcoded in components. */

/** A short bilingual string. Thai is the default locale; English is secondary. */
export interface Localized {
  th: string;
  en: string;
}

/** Brand color tokens from the design system (see app/globals.css / CLAUDE.md). */
export type ColorToken =
  | "sunshine"
  | "meadow"
  | "tomato"
  | "sky"
  | "bubblegum"
  | "tangerine"
  | "cornflower"
  | "peach";

/** A themed zone. Events are grouped under exactly one category. */
export interface Category {
  slug: string;
  name: Localized;
  description: Localized;
  /** Zone illustration, path under /public. */
  thumbnail: string;
  /** Brand color token used to theme this zone across all design variants. */
  color: ColorToken;
  thumbnailLetter: Localized;
}

export interface GalleryImage {
  /** Path under /public, or a remote URL. */
  src: string;
  alt: Localized;
}

/** One occurrence of an event. With the session-as-ticket-type model, each
 *  session lists the platform ticket codes that admit on that day so the
 *  pass shows the right date. */
export interface EventSession {
  /** ISO date, e.g. "2026-08-15". */
  date: string;
  /** Local time, e.g. "10:00". */
  start: string;
  end: string;
  /** TicketConfig codes (from the ticket platform) belonging to this session. */
  ticketCodes?: string[];
}

export interface EventSchedule {
  venue: Localized;
  /** All occurrences, in chronological order. Single-day events have one. */
  sessions: EventSession[];
}

export interface FestivalEvent {
  slug: string;
  thumbnail: string;
  title: Localized;
  /** One-line teaser for cards and listings. */
  summary: Localized;
  /** Full description for the event detail page. */
  description: Localized;
  /** Category slug — must match a Category.slug. */
  category: string;
  schedule: EventSchedule;
  /** Recommended age range, e.g. "4–8". */
  ageRange: string;
  /** Seats, if shown. */
  capacity?: number;
  gallery: GalleryImage[];
  /** External registration system URL — fallback when the ticket service is unavailable. */
  registrationUrl: string;
  /** Event code registered in the ticket platform. When set, the site sells tickets
   *  in-app through the ticket API instead of linking out. */
  ticketEventCode?: string;
  /** Surfaced on home pages when true. */
  featured?: boolean;
}
