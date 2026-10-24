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
 *  - <lg: the same grid with mini blocks; lanes keep a minimum width, so a
 *    week scrolls sideways behind the same fades, buttons and a swipe hint.
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
  // One scroller per week per grid (compact and wide both render; CSS shows one).
  const scrollerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // The block that opened the drawer, so closing can hand focus back to it.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [canScroll, setCanScroll] = useState<Record<string, { left: boolean; right: boolean }>>({});

  const updateScrollState = useCallback(() => {
    const next: Record<string, { left: boolean; right: boolean }> = {};
    for (const [key, el] of scrollerRefs.current) {
      next[key] = { left: el.scrollLeft > 4, right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4 };
    }
    setCanScroll(next);
  }, []);

  // Measured by a ResizeObserver (it fires once on observe, then on every
  // size change) so the overflow affordances track the viewport and fonts.
  useEffect(() => {
    const ro = new ResizeObserver(updateScrollState);
    for (const el of scrollerRefs.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const update = () => setTouchUI(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const scrollByColumn = (key: string, direction: 1 | -1) => {
    const el = scrollerRefs.current.get(key);
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
    const isSelected = opensDrawer && selected?.slug === b.slug && selected.session === session;
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
    } ${faded ? "opacity-25" : ""} ${compact ? "mb-px rounded-r-md p-1" : "mb-0.5 rounded-r-lg px-2 py-1"}`;

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
              prev?.slug === b.slug && prev.session === session ? null : { slug: b.slug, session },
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
        className={`grid ${compact ? "gap-x-0.5" : "gap-x-1.5"}`}
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
          className={`self-start -translate-y-1/2 text-right leading-none tabular-nums text-ink/50 ${compact ? "pr-0.5 text-[9px]" : "pr-2 text-xs"}`}
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
            ? `minmax(${5 * d.lanes}rem, ${d.lanes}fr)`
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

  /** One week: the day × hour grid inside a horizontal scroller. When it
   *  overflows, edge fades and prev/next buttons make the hidden days obvious,
   *  and the hour gutter stays pinned so times are never scrolled away. */
  const weekRow = (week: BoardDay[], w: number, compact: boolean) => {
    const key = `${compact ? "c" : "w"}${w}`;
    const scroll = canScroll[key];
    const arrow = compact
      ? "h-8 w-8 border-2 text-base"
      : "h-10 w-10 border-2 text-lg transition-transform hover:scale-110";
    return (
      <div key={week[0].date} className={`relative ${w > 0 ? (compact ? "mt-6" : "mt-10") : ""}`}>
        <div
          ref={(el) => {
            if (el) scrollerRefs.current.set(key, el);
            else scrollerRefs.current.delete(key);
          }}
          onScroll={updateScrollState}
          className="overflow-x-auto overscroll-x-contain"
        >
          <div
            className={`grid ${compact ? "gap-x-1" : "gap-x-3"}`}
            style={{ gridTemplateColumns: columns(week, compact) }}
          >
            <div className="sticky left-0 z-10 bg-paper" />
            {week.map((day) =>
              day.blocks.length === 0 ? (
                <div
                  key={day.date}
                  className={`flex flex-col items-center border-b-[3px] border-peach text-ink/40 ${
                    compact ? "pb-1" : "pb-2"
                  }`}
                >
                  <span className={`font-display leading-none ${compact ? "text-base" : "text-xl"}`}>
                    {day.dayNum}
                  </span>
                  <span className={`leading-tight ${compact ? "text-[10px]" : "text-[11px]"}`}>{day.weekday}</span>
                </div>
              ) : compact ? (
                <div key={day.date} className="border-b-[3px] border-peach pb-1 text-center text-ink">
                  <span className="block text-[10px] leading-tight text-ink/55">{day.weekday}</span>
                  <span className="block font-display text-base leading-tight">{day.dayNum}</span>
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
            <div className={`sticky left-0 z-10 bg-paper ${compact ? "pt-2" : "pt-3"}`}>{hourGutter(compact)}</div>
            {week.map((day) => (
              <div key={day.date} className={compact ? "pt-2" : "pt-3"}>
                {dayColumn(day, compact)}
              </div>
            ))}
          </div>
        </div>

        {scroll?.left && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center bg-gradient-to-r from-paper to-transparent">
            <button
              type="button"
              aria-label={t("earlierDays")}
              onClick={() => scrollByColumn(key, -1)}
              className={`pointer-events-auto ml-1 flex items-center justify-center rounded-full border-ink/15 bg-paper text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${arrow}`}
            >
              ←
            </button>
          </div>
        )}
        {scroll?.right && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-gradient-to-l from-paper to-transparent">
            <button
              type="button"
              aria-label={t("laterDays")}
              onClick={() => scrollByColumn(key, 1)}
              className={`pointer-events-auto mr-1 flex items-center justify-center rounded-full border-ink/15 bg-paper text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${arrow}`}
            >
              →
            </button>
          </div>
        )}
      </div>
    );
  };

  // Spelled out on the compact grid, where a week is wider than the screen.
  const swipeHint = Object.entries(canScroll).some(([k, v]) => k.startsWith("c") && (v.left || v.right));

  return (
    <>
      {/* <lg: lanes keep a readable minimum width, so a week scrolls sideways. */}
      <div className="lg:hidden">
        <p className="mb-2 text-xs text-ink/50">
          {t("tapEventHint")}
          {swipeHint && (
            <>
              {" · "}
              <span className="font-semibold text-ink/70">{t("swipeDaysHint")}</span>
            </>
          )}
        </p>
        {weeks.map((week, w) => weekRow(week, w, true))}
        {legendRow}
      </div>

      {/* ≥lg: one day × hour grid per week. */}
      <div className="hidden lg:block">
        {touchUI && <p className="mb-2 text-xs text-ink/50">{t("tapEventHint")}</p>}
        {weeks.map((week, w) => weekRow(week, w, false))}
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
