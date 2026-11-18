/* The organizer's preview: CowTicket's public page JSON, opened with a
 * one-off token, turned into the site's FestivalEvent shape so the normal
 * event page can draw it. Runs in the browser (the token is only known at
 * request time, and the site is a static export). No secret is involved: the
 * token is the credential, and the endpoint is public with open CORS. */
import type { Admission, EventSession, FestivalEvent } from "@/types/content";
import type { RefundPolicy, TicketAddOn } from "@/lib/ticketApi";
import type { TicketsResponse } from "@/lib/storefront";
import { COWTICKET_PUBLIC_URL } from "@/lib/site";

/** The parts of GET /api/public/pages/preview this site reads. A ticket type
 *  here carries the same fields the purchase box takes from /api/tickets. */
interface PreviewTicketType {
  code: string;
  name: string;
  group: string | null;
  price: number;
  limitPerOrder: number;
  available: number;
  capacityUnit?: "tickets" | "seats";
  sessionStartAt: string | null;
  sessionEndAt: string | null;
  sessionDate: string | null;
  venueName?: string | null;
  addOns?: TicketAddOn[];
}

export interface PreviewPage {
  slug: string;
  event: { name: string; eventCode: string };
  organizer: { name: string | null };
  where: { venueName: string | null };
  description: string | null;
  images: { coverUrl: string | null };
  siteValues?: Record<string, string | number>;
  refundPolicy?: RefundPolicy | null;
  /** The LINE link, or null when not on sale through LINE right now. */
  buyUrl?: string | null;
  /** The live ticket list. Documented as "tickets"; the API also answers
   *  "ticketTypes", so read either. */
  tickets?: PreviewTicketType[];
  ticketTypes?: PreviewTicketType[];
  preview: { status: string };
}

export type PreviewResult =
  | { kind: "ok"; page: PreviewPage }
  /** Bad, expired (7 days) or wrong-event token. Never fall back to the
   *  published page: the organizer must know the link no longer works. */
  | { kind: "invalid" }
  /** One link opened more than 60 times a minute. */
  | { kind: "rateLimited" }
  | { kind: "error" };

export async function fetchPreview(token: string): Promise<PreviewResult> {
  try {
    const url = `${COWTICKET_PUBLIC_URL}/api/public/pages/preview?preview=${encodeURIComponent(token)}`;
    // Never cached: the proposal can change, and a stale one misleads.
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return { kind: "invalid" };
    if (res.status === 429) return { kind: "rateLimited" };
    if (!res.ok) return { kind: "error" };
    return { kind: "ok", page: (await res.json()) as PreviewPage };
  } catch {
    return { kind: "error" };
  }
}

/** The preview's own ticket list in the shape the purchase box reads, so the
 *  box shows the same environment and moment as the page above it. Mirrors
 *  the shaping in functions/api/tickets.ts. The public page names no payment
 *  methods; a LINE link means chat checkout is on, which is all this site
 *  sells through. It asks no checkout questions here: the chat does. */
export function ticketsFromPreview(page: PreviewPage): TicketsResponse {
  const types = page.tickets ?? page.ticketTypes ?? [];
  return {
    tickets: types.map((c) => ({
      code: c.code,
      name: c.name,
      group: c.group ?? null,
      price: c.price,
      limitPerOrder: c.limitPerOrder,
      available: c.available,
      sessionStartAt: c.sessionStartAt ?? null,
      sessionEndAt: c.sessionEndAt ?? null,
      sessionDate: c.sessionDate ?? null,
      capacityUnit: c.capacityUnit ?? "tickets",
      // max 0 is how an add-on orders still include gets switched off.
      addOns: (c.addOns ?? [])
        .filter((a) => a.max > 0)
        .map((a) => ({
          code: a.code,
          name: a.name,
          included: a.included,
          max: a.max,
          extraPrice: a.extraPrice,
          countsAsSeat: a.countsAsSeat ?? false,
          fields: a.fields ?? [],
        })),
    })),
    refundPolicy: page.refundPolicy ?? null,
    paymentMethods: page.buyUrl ? ["PROMPTPAY"] : [],
    purchaseForm: [],
  };
}

/** Same convention as the content scripts: platform codes carry the year. */
const EVENT_CODE_PREFIX = "cbf2026-";

const text = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

const ADMISSIONS: readonly Admission[] = ["ticket", "free", "donation"];

/** An instant as Bangkok wall-clock date and time. */
function bangkok(iso: string): { date: string; time: string } {
  const local = new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** Sessions from the live ticket list — used only for an event the site does
 *  not have yet. It lists only what is on sale right now, which is fine for a
 *  preview; the published page is built from every session. */
function sessionsFrom(types: PreviewTicketType[], defaultVenue: string): EventSession[] {
  return types
    .filter((t) => t.sessionStartAt && t.sessionEndAt)
    .map((t) => {
      const start = bangkok(t.sessionStartAt!);
      const end = bangkok(t.sessionEndAt!);
      return {
        date: start.date,
        start: start.time,
        end: end.time,
        ...(t.venueName && t.venueName !== defaultVenue ? { venue: t.venueName } : {}),
        ticketCodes: [t.code],
      };
    })
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

/** The event as it would look with the proposed changes: the page fields from
 *  CowTicket over the site's own copy of the event (`base`), which supplies
 *  what CowTicket does not hold (mascot, alt text, every session). With no
 *  base — an event not on the site yet — everything comes from CowTicket. */
export function eventFromPreview(page: PreviewPage, base: FestivalEvent | undefined): FestivalEvent {
  const values = page.siteValues ?? {};
  const types = page.tickets ?? page.ticketTypes ?? [];
  const venue = text(page.where.venueName) ?? base?.schedule.venue ?? "";
  const price = base?.price ?? (types[0] ? types[0].price / 100 : 0);
  const admissionValue = text(values.admission);
  const admission: Admission =
    admissionValue && (ADMISSIONS as readonly string[]).includes(admissionValue)
      ? (admissionValue as Admission)
      : (base?.admission ?? (price > 0 ? "ticket" : "free"));
  // The site's optimised poster when it has one; CowTicket's otherwise.
  const thumbnail = base?.thumbnail ?? page.images.coverUrl ?? "";
  const capacityLabel = text(values.capacityLabel);
  const admissionNote = text(values.admissionNote);
  const presenter = text(page.organizer.name) ?? base?.presenter;

  return {
    slug: base?.slug ?? page.event.eventCode.replace(EVENT_CODE_PREFIX, ""),
    thumbnail,
    mascot: base?.mascot,
    title: page.event.name,
    summary: text(values.summary) ?? base?.summary ?? "",
    description: text(page.description) ?? base?.description ?? "",
    ...(presenter ? { presenter } : {}),
    category: text(values.category) ?? base?.category ?? "",
    schedule: base
      ? { ...base.schedule, venue }
      : { venue, sessions: sessionsFrom(types, venue) },
    ageRange: text(values.ageRange) ?? base?.ageRange ?? "",
    price,
    capacity: base?.capacity,
    ...(capacityLabel ? { capacityLabel } : {}),
    gallery: base?.gallery ?? (thumbnail ? [{ src: thumbnail, alt: page.event.name }] : []),
    ticketEventCode: page.event.eventCode,
    admission,
    ...(admissionNote ? { admissionNote } : {}),
  };
}
