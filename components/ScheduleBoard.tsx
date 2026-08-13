import type { FestivalEvent } from "@/types/content";
import { getCategories, getCategory, getFestivalDates } from "@/lib/content";
import { t, pick, formatDate, formatWeekday, formatMonth } from "@/lib/i18n";
import ScheduleBoardGrid, { type BoardBlock } from "@/components/ScheduleBoardGrid";
import type { BoardEventDetail } from "@/components/ScheduleEventDrawer";

/** Day × time-of-day schedule board (home page). Every session of every event
 *  appears as a colored block in its day column, so visitors see the whole
 *  festival at a glance with the date as the primary axis. This server half
 *  resolves content into plain props; ScheduleBoardGrid renders them with
 *  hover cross-highlighting. */

const BANDS = [
  { key: "morning", from: 0, to: 12 },
  { key: "afternoon", from: 12, to: 17 },
  { key: "evening", from: 17, to: 24 },
] as const;

function bandOf(start: string): (typeof BANDS)[number]["key"] {
  const hour = Number(start.slice(0, 2));
  return (BANDS.find((b) => hour >= b.from && hour < b.to) ?? BANDS[0]).key;
}

export default function ScheduleBoard({ events }: { events: FestivalEvent[] }) {
  const dates = getFestivalDates();

  // blocks[date][band] → sessions starting in that slot, sorted by start time.
  const blocks = new Map<string, Map<string, BoardBlock[]>>();
  for (const event of events) {
    for (const s of event.schedule.sessions) {
      const byBand = blocks.get(s.date) ?? new Map<string, BoardBlock[]>();
      const list = byBand.get(bandOf(s.start)) ?? [];
      list.push({
        slug: event.slug,
        title: pick(event.title),
        date: s.date,
        start: s.start,
        end: s.end,
        color: getCategory(event.category)?.color ?? "peach",
      });
      byBand.set(bandOf(s.start), list);
      blocks.set(s.date, byBand);
    }
  }
  for (const byBand of blocks.values()) {
    for (const list of byBand.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  }

  // Brief-detail lookup for the mobile drawer, keyed by slug. Resolved here so
  // the client component never touches the content layer.
  const details: Record<string, BoardEventDetail> = {};
  for (const event of events) {
    details[event.slug] = {
      slug: event.slug,
      title: pick(event.title),
      summary: pick(event.summary),
      category: pick(getCategory(event.category)?.name ?? { th: "", en: "" }),
      color: getCategory(event.category)?.color ?? "peach",
      venue: pick(event.schedule.venue),
      ageRange: event.ageRange,
      sessions: event.schedule.sessions.map((s) => ({
        key: `${s.date}${s.start}`,
        label: formatDate(s.date),
        time: `${s.start}–${s.end}`,
      })),
    };
  }

  return (
    <ScheduleBoardGrid
      details={details}
      days={dates.map((date) => ({
        date,
        label: formatDate(date),
        weekday: formatWeekday(date),
        dayNum: Number(date.slice(-2)),
        month: formatMonth(date),
      }))}
      legend={getCategories().map((cat) => ({ label: pick(cat.name), color: cat.color }))}
      bands={BANDS.map((band) => ({
        label: t(band.key),
        cells: dates.map((date) => blocks.get(date)?.get(band.key) ?? []),
      }))}
    />
  );
}
