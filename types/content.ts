/** Shared content model for the festival microsite.
 *  Events and categories are editable data (see content/), never hardcoded in components. */

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
  name: string;
  /** One-line hook shown under the zone name. */
  tagline: string;
  description: string;
  /** Zone illustration, path under /public. */
  thumbnail: string;
  /** Brand color token used to theme this zone across all design variants. */
  color: ColorToken;
  thumbnailLetter: string;
}

export interface GalleryImage {
  /** Path under /public, or a remote URL. */
  src: string;
  alt: string;
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
  /** Room for this session only, when it differs from the event's default
   *  `schedule.venue` (e.g. a workshop that moves rooms between dates). */
  venue?: string;
}

export interface EventSchedule {
  /** Default room. A session may override it with its own `venue`. */
  venue: string;
  /** All occurrences, in chronological order. Single-day events have one. */
  sessions: EventSession[];
}

export interface FestivalEvent {
  slug: string;
  thumbnail: string;
  /** Optional cut-out character (transparent PNG under /content/mascots/)
   *  that stands beside the poster on the detail page. */
  mascot?: string;
  title: string;
  /** One-line teaser for cards and listings. */
  summary: string;
  /** Full description for the event detail page — the organiser's own copy,
   *  verbatim. May contain newlines; the page preserves them. */
  description: string;
  /** Who runs it (person and/or organisation). Shown as its own line, never
   *  folded into the description. */
  presenter?: string;
  /** Category slug — must match a Category.slug. */
  category: string;
  schedule: EventSchedule;
  /** Recommended age range, e.g. "4–8". */
  ageRange: string;
  /** Ticket price in Thai baht, as printed on the poster. 0 = free (walk-in
   *  or donation box). The sync script pushes it to the ticket platform in
   *  satang; the site itself reads prices back from the platform. */
  price: number;
  /** Seats, if shown. */
  capacity?: number;
  gallery: GalleryImage[];
  /** Event code registered in the ticket platform. When set, the site sells tickets
   *  in-app through the ticket API instead of linking out. */
  ticketEventCode?: string;
  /** How visitors get in. "ticket": sold in-app through the ticket API.
   *  "free": walk in, nothing sold. "donation": walk in, pay what you wish at
   *  the door. For the last two the detail page renders an admission notice
   *  instead of the purchase UI and never calls the ticket API. Deliberately
   *  explicit editorial content — an empty ticket response alone also means
   *  "sales paused", which must NOT read as "free, walk in". */
  admission: Admission;
}

export type Admission = "ticket" | "free" | "donation";
