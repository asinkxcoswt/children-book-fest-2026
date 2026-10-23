import type { FestivalEvent } from "@/types/content";
import { getCategories, getCategory, getFestivalDates, hasSessionVenues, sessionVenue } from "@/lib/content";
import { pick, formatDate, formatWeekday, formatMonth } from "@/lib/i18n";
import ScheduleBoardGrid, { type BoardBlock, type BoardDay } from "@/components/ScheduleBoardGrid";
import type { BoardEventDetail } from "@/components/ScheduleEventDrawer";

/** Day × hour schedule board (home page). Every session of every event is a
 *  block placed on a real time axis: its row span is its duration, and
 *  sessions that overlap on the same day sit side by side in lanes. Row
 *  height therefore follows the clock, not the busiest day, so a packed
 *  Saturday never stretches an empty Tuesday. This server half resolves
 *  content into plain props; ScheduleBoardGrid renders them. */

/** The time axis is sliced into half-hour slots so a session that ends at
 *  :50 still fills its full hour visually. */
const SLOT_MINUTES = 30;
const DAYS_PER_ROW = 8;

function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** Greedy interval colouring: each session takes the first lane whose last
 *  session has already ended. Sessions arrive sorted by start time. */
function assignLanes(sessions: { startMin: number; endMin: number }[]): number[] {
  const laneEnds: number[] = [];
  return sessions.map((s) => {
    let lane = laneEnds.findIndex((end) => end <= s.startMin);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = s.endMin;
    return lane;
  });
}

export default function ScheduleBoard({ events }: { events: FestivalEvent[] }) {
  const dates = getFestivalDates();

  // Raw sessions per date, then the axis is sized from the data so the board
  // never shows hours with nothing in them.
  type Raw = Omit<BoardBlock, "rowStart" | "rowEnd" | "lane" | "laneSpan"> & { startMin: number; endMin: number };
  const byDate = new Map<string, Raw[]>();
  let firstMin = Infinity;
  let lastMin = -Infinity;
  for (const event of events) {
    for (const s of event.schedule.sessions) {
      const startMin = minutesOf(s.start);
      const endMin = Math.max(minutesOf(s.end), startMin + SLOT_MINUTES);
      firstMin = Math.min(firstMin, startMin);
      lastMin = Math.max(lastMin, endMin);
      const list = byDate.get(s.date) ?? [];
      list.push({
        slug: event.slug,
        title: pick(event.title),
        date: s.date,
        start: s.start,
        end: s.end,
        color: getCategory(event.category)?.color ?? "peach",
        startMin,
        endMin,
      });
      byDate.set(s.date, list);
    }
  }
  // Axis snaps outward to whole hours so the gutter labels read cleanly.
  const axisStart = events.length ? Math.floor(firstMin / 60) * 60 : 10 * 60;
  const axisEnd = events.length ? Math.ceil(lastMin / 60) * 60 : 18 * 60;
  const slotCount = (axisEnd - axisStart) / SLOT_MINUTES;
  const hours: string[] = [];
  for (let m = axisStart; m < axisEnd; m += 60) hours.push(`${String(m / 60).padStart(2, "0")}:00`);

  const days: BoardDay[] = dates.map((date) => {
    const raw = (byDate.get(date) ?? []).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const lanes = assignLanes(raw);
    const laneCount = Math.max(1, ...lanes.map((l) => l + 1));
    // A session spreads into the lanes to its right for as long as nothing
    // there overlaps it in time, so a solo session isn't a sliver on a day
    // that has three rooms running at another hour.
    const laneSpan = (i: number) => {
      let span = 1;
      while (lanes[i] + span < laneCount) {
        const target = lanes[i] + span;
        const clash = raw.some(
          (o, j) => j !== i && lanes[j] === target && o.startMin < raw[i].endMin && o.endMin > raw[i].startMin,
        );
        if (clash) break;
        span += 1;
      }
      return span;
    };
    const blocks: BoardBlock[] = raw.map((r, i) => ({
      slug: r.slug,
      title: r.title,
      date: r.date,
      start: r.start,
      end: r.end,
      color: r.color,
      // CSS grid lines are 1-based.
      rowStart: (r.startMin - axisStart) / SLOT_MINUTES + 1,
      rowEnd: Math.ceil((r.endMin - axisStart) / SLOT_MINUTES) + 1,
      lane: lanes[i],
      laneSpan: laneSpan(i),
    }));
    return {
      date,
      label: formatDate(date),
      weekday: formatWeekday(date),
      dayNum: Number(date.slice(-2)),
      month: formatMonth(date),
      lanes: laneCount,
      blocks,
    };
  });

  // Brief-detail lookup for the drawer, keyed by slug. Resolved here so the
  // client component never touches the content layer.
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
        // Room per session only when the event moves between rooms.
        label: hasSessionVenues(event)
          ? `${formatDate(s.date)} · ${pick(sessionVenue(event, s))}`
          : formatDate(s.date),
        time: `${s.start}–${s.end}`,
      })),
    };
  }

  // The 16-day run is split into rows of a week each so every day stays
  // visible without 16 cramped columns. Rows start on the festival's first day.
  const weeks: BoardDay[][] = [];
  for (let i = 0; i < days.length; i += DAYS_PER_ROW) weeks.push(days.slice(i, i + DAYS_PER_ROW));

  return (
    <ScheduleBoardGrid
      details={details}
      legend={getCategories().map((cat) => ({ label: pick(cat.name), color: cat.color }))}
      weeks={weeks}
      axis={{ hours, slotCount, slotsPerHour: 60 / SLOT_MINUTES }}
    />
  );
}
