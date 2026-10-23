"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";
import ScheduleEventDrawer, { type BoardEventDetail } from "@/components/ScheduleEventDrawer";

export interface BoardBlock {
  slug: string;
  title: string;
  /** ISO date of this session — with `start`, identifies the session uniquely. */
  date: string;
  start: string;
  end: string;
  color: ColorToken;
  /** 1-based grid lines on the day's time axis (half-hour slots). */
  rowStart: number;
  rowEnd: number;
  /** 0-based column within the day, for sessions that overlap in time. */
  lane: number;
  /** How many lanes the block may widen into (free of overlaps), ≥ 1. */
  laneSpan: number;
}

export interface BoardDay {
  date: string;
  /** Labels are preformatted on the server — Intl output can differ between
   *  Node and the browser and would break hydration. */
  label: string;
  weekday: string;
  dayNum: number;
  month: string;
  /** How many sessions run at once at the busiest moment of the day. */
  lanes: number;
  blocks: BoardBlock[];
}

export interface BoardAxis {
  /** Hour labels for the gutter, first to last. */
  hours: string[];
  /** Total half-hour slots on the axis. */
  slotCount: number;
  slotsPerHour: number;
}

interface Props {
  /** One week of days per row, stacked in order. */
  weeks: BoardDay[][];
  axis: BoardAxis;
  /** Category legend for the color-coded blocks. */
  legend: { label: string; color: ColorToken }[];
  /** Brief details per event slug, for the drawer. */
  details: Record<string, BoardEventDetail>;
}

/** Presentational half of the schedule board: a printed-programme timetable
 *  (typographic day headers — big numeral over a peach rule — hour hairlines
 *  down each column) holding zone-tinted event blocks with a solid spine in
 *  the zone colour. A block's height is its duration; overlapping sessions
 *  share the day in lanes; days with nothing on shrink to a date strip.
 *  - ≥lg: day-column grid; when it overflows, edge fades + prev/next buttons
 *    make the hidden days obvious. Hovering/focusing a block fades every other
 *    event so all sessions of the same event stand out.
 *  - <lg: the same grid compressed to fit the viewport, mini blocks.
 *  Touch has no hover, so on any no-hover device tapping a block selects it
 *  instead of navigating: it applies the same cross-highlight and opens a
 *  brief-detail drawer, keeping the visitor on the board while they compare. */
export default function ScheduleBoardGrid({ weeks, axis, legend, details }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ slug: string; session: string } | null>(null);
  // No-hover device (e.g. a large tablet): blocks in the ≥lg grid open the drawer
  // instead of navigating. false during SSR/hydration so the server-rendered
  // links match; flips right after mount on touch devices.
  const [touchUI, setTouchUI] = useState(false);
  const scrollerRefs = useRef<(HTMLDivElement | null)[]>([]);
  // The block that opened the drawer, so closing can hand focus back to it.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [canScroll, setCanScroll] = useState<{ left: boolean; right: boolean }[]>([]);

  const updateScrollState = useCallback(() => {
    setCanScroll(
      scrollerRefs.current.map((el) =>
        el
          ? { left: el.scrollLeft > 4, right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4 }
          : { left: false, right: false },
      ),
    );
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const update = () => setTouchUI(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const scrollByColumn = (week: number, direction: 1 | -1) => {
    const el = scrollerRefs.current[week];
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.6, behavior: "smooth" });
  };

  const hoverHandlers = (slug: string) => ({
    onMouseEnter: () => setHovered(slug),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(slug),
    onBlur: () => setHovered(null),
  });

  const closeDrawer = useCallback(() => {
    setSelected(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const ticket = (b: BoardBlock, compact: boolean) => {
    const c = tokenClasses(b.color);
    const opensDrawer = compact || touchUI;
    // Pointer devices highlight on hover; touch highlights the selected block.
    const active = opensDrawer ? (selected?.slug ?? null) : hovered;
    const faded = active !== null && active !== b.slug;
    const session = `${b.date}${b.start}`;
    const isSelected = opensDrawer && selected?.session === session;
    const lit = isSelected || (!opensDrawer && hovered === b.slug);
    const placement = {
      gridRow: `${b.rowStart} / ${b.rowEnd}`,
      gridColumn: `${b.lane + 1} / span ${b.laneSpan}`,
    };
    // Title lines that fit under the time line within the block's own height
    // (half-hour slots), so a clipped title never ends mid-phrase. Literal
    // class names so the Tailwind scanner sees them.
    const slots = b.rowEnd - b.rowStart;
    const clamp = compact
      ? slots <= 2
        ? "line-clamp-1"
        : slots <= 3
          ? "line-clamp-2"
          : "line-clamp-3"
      : slots <= 2
        ? "line-clamp-2"
        : slots <= 3
          ? "line-clamp-3"
          : "line-clamp-4";

    const body = (
      <>
        <span
          className={`block font-bold leading-tight tabular-nums ${
            compact ? "text-[10px] @max-[2.25rem]:text-[9px]" : "text-[11px] tracking-wide"
          }`}
        >
          {compact ? b.start : `${b.start}–${b.end}`}
        </span>
        {/* The block is a container: below ~2.25rem wide (several lanes on a
            phone) there is no room for a title, so it goes screen-reader-only
            and the drawer does the rest. Tablets keep their titles. */}
        <span className="@max-[2.25rem]:sr-only">
          <span
            className={`${clamp} font-body font-normal ${
              compact ? "break-words text-[11px] leading-tight" : "text-[13px] leading-tight"
            }`}
          >
            {b.title}
          </span>
        </span>
      </>
    );

    // Resting: a pale tint with a solid spine. Lit (hover/selected): the full
    // zone colour, so the active event jumps out of a crowded day.
    const shared = `@container block min-h-0 min-w-0 overflow-hidden text-left border-l-4 ${c.edge} transition-[transform,opacity,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
      lit ? `${c.bg} ${c.on}` : `${c.soft} text-ink`
    } ${faded ? "opacity-25" : ""} ${compact ? "rounded-r-md p-1" : "rounded-r-lg px-2 py-1"}`;

    // On touch there's no hover to preview with, so a tap opens the drawer
    // rather than committing the visitor to a page they can't preview.
    if (opensDrawer) {
      return (
        <button
          key={`${b.slug}${b.start}`}
          type="button"
          style={placement}
          aria-haspopup="dialog"
          aria-expanded={isSelected}
          onClick={(e) => {
            triggerRef.current = e.currentTarget;
            setSelected((prev) =>
              prev?.session === session ? null : { slug: b.slug, session },
            );
          }}
          className={`${shared} ${isSelected ? "ring-2 ring-ink ring-offset-1" : ""}`}
        >
          {body}
        </button>
      );
    }

    return (
      <Link
        key={`${b.slug}${b.start}`}
        href={`/event/${b.slug}`}
        style={placement}
        {...hoverHandlers(b.slug)}
        className={`${shared} hover:-translate-y-0.5`}
      >
        {body}
      </Link>
    );
  };

  /** A day column: the time axis as grid rows, lanes as grid columns, hour
   *  hairlines painted as a repeating background so they need no elements. */
  const dayColumn = (day: BoardDay, compact: boolean) => {
    const slot = compact ? "1.25rem" : "1.75rem";
    return (
      <div
        key={day.date}
        className={`grid ${compact ? "gap-x-0.5 gap-y-px" : "gap-x-1.5 gap-y-0.5"}`}
        style={{
          gridTemplateRows: `repeat(${axis.slotCount}, ${slot})`,
          gridTemplateColumns: `repeat(${day.lanes}, minmax(0, 1fr))`,
          backgroundImage: `repeating-linear-gradient(to bottom, color-mix(in srgb, var(--color-ink) 12%, transparent) 0 1px, transparent 1px calc(${slot} * ${axis.slotsPerHour}))`,
        }}
      >
        {day.blocks.map((b) => ticket(b, compact))}
      </div>
    );
  };

  const hourGutter = (compact: boolean) => (
    <div
      className="grid"
      style={{ gridTemplateRows: `repeat(${axis.slotCount}, ${compact ? "1.25rem" : "1.75rem"})` }}
    >
      {axis.hours.map((h) => (
        <span
          key={h}
          className={`-mt-2 text-right tabular-nums text-ink/50 ${compact ? "pr-0.5 text-[9px]" : "pr-2 text-xs"}`}
          style={{ gridRow: `span ${axis.slotsPerHour}` }}
        >
          {h}
        </span>
      ))}
    </div>
  );

  /** Days with sessions take the width; empty days collapse to a date strip
   *  so the festival's full run stays visible without eating the board. */
  const columns = (week: BoardDay[], compact: boolean) =>
    [
      compact ? "1.75rem" : "3rem",
      ...week.map((d) =>
        d.blocks.length === 0
          ? compact
            ? "1.25rem"
            : "3rem"
          : compact
            ? `minmax(0, ${d.lanes}fr)`
            : `minmax(${6.5 * d.lanes}rem, ${d.lanes}fr)`,
      ),
    ].join(" ");

  const legendRow = (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-ink/10 pt-3 text-sm text-ink/80">
      {legend.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span aria-hidden className={`h-3 w-3 rounded border-2 border-ink ${tokenClasses(item.color).bg}`} />
          {item.label}
        </span>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile: each week's grid squeezed to the viewport — all days visible, mini tickets. */}
      <div className="lg:hidden">
        <p className="mb-2 text-xs text-ink/50">{t("tapEventHint")}</p>
        {weeks.map((week, w) => (
          <div
            key={week[0].date}
            className={`grid gap-x-1 ${w > 0 ? "mt-6" : ""}`}
            style={{ gridTemplateColumns: columns(week, true) }}
          >
            <div />
            {week.map((day) => (
              <div
                key={day.date}
                className={`border-b-[3px] border-peach pb-1 text-center ${
                  day.blocks.length === 0 ? "text-ink/40" : "text-ink"
                }`}
              >
                <span className="block text-[10px] leading-tight text-ink/55">{day.weekday}</span>
                <span className="block font-display text-base leading-tight">{day.dayNum}</span>
              </div>
            ))}
            <div className="pt-2">{hourGutter(true)}</div>
            {week.map((day) => (
              <div key={day.date} className="pt-2">
                {dayColumn(day, true)}
              </div>
            ))}
          </div>
        ))}
        {legendRow}
      </div>

      {/* ≥lg: one day × hour grid per week, each with overflow affordances. */}
      <div className="hidden lg:block">
        {touchUI && <p className="mb-2 text-xs text-ink/50">{t("tapEventHint")}</p>}
        {weeks.map((week, w) => (
          <div key={week[0].date} className={`relative ${w > 0 ? "mt-10" : ""}`}>
            <div
              ref={(el) => {
                scrollerRefs.current[w] = el;
              }}
              onScroll={updateScrollState}
              className="overflow-x-auto"
            >
              <div className="grid gap-x-3" style={{ gridTemplateColumns: columns(week, false) }}>
                <div />
                {week.map((day) =>
                  day.blocks.length === 0 ? (
                    <div
                      key={day.date}
                      className="flex flex-col items-center border-b-[3px] border-peach pb-2 text-ink/40"
                    >
                      <span className="font-display text-xl leading-none">{day.dayNum}</span>
                      <span className="text-[11px] leading-tight">{day.weekday}</span>
                    </div>
                  ) : (
                    <div key={day.date} className="flex items-baseline gap-2 border-b-[3px] border-peach px-1 pb-2">
                      <span className="font-display text-3xl leading-none text-ink">{day.dayNum}</span>
                      <span className="text-xs leading-tight text-ink/55">
                        <span className="block text-sm text-ink">{day.weekday}</span>
                        {day.month}
                      </span>
                    </div>
                  ),
                )}
                <div className="pt-3">{hourGutter(false)}</div>
                {week.map((day) => (
                  <div key={day.date} className="pt-3">
                    {dayColumn(day, false)}
                  </div>
                ))}
              </div>
            </div>

            {canScroll[w]?.left && (
              <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center bg-gradient-to-r from-paper to-transparent">
                <button
                  type="button"
                  aria-label={t("earlierDays")}
                  onClick={() => scrollByColumn(w, -1)}
                  className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/15 bg-paper text-lg text-ink shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                >
                  ←
                </button>
              </div>
            )}
            {canScroll[w]?.right && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-end bg-gradient-to-l from-paper to-transparent">
                <button
                  type="button"
                  aria-label={t("laterDays")}
                  onClick={() => scrollByColumn(w, 1)}
                  className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/15 bg-paper text-lg text-ink shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                >
                  →
                </button>
              </div>
            )}
          </div>
        ))}
        {legendRow}
      </div>

      {selected && details[selected.slug] && (
        <>
          {/* Keeps the lower rows reachable above the open sheet. */}
          <div aria-hidden className="h-[45svh]" />
          <ScheduleEventDrawer
            detail={details[selected.slug]}
            currentSession={selected.session}
            onClose={closeDrawer}
          />
        </>
      )}
    </>
  );
}
