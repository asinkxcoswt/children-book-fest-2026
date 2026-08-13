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
}

interface Props {
  /** Column headers, chronological. Labels are preformatted on the server —
   *  Intl output can differ between Node and the browser and would break hydration. */
  days: { date: string; label: string; weekday: string; dayNum: number; month: string }[];
  /** Row per time band; cells align with `days` order. */
  bands: { label: string; cells: BoardBlock[][] }[];
  /** Category legend for the color-coded blocks. */
  legend: { label: string; color: ColorToken }[];
  /** Brief details per event slug, for the mobile drawer. */
  details: Record<string, BoardEventDetail>;
}

/** Presentational half of the schedule board: a printed-programme outline
 *  (typographic day headers — big numeral over a peach rule — and dashed
 *  hairlines for empty slots) holding solid zone-colored event blocks.
 *  - ≥sm: day-column grid; when it overflows, edge fades + prev/next buttons
 *    make the hidden days obvious. Hovering/focusing a block fades every other
 *    event so all sessions of the same event stand out.
 *  - <sm: the same grid compressed to fit the viewport, mini blocks. Touch has
 *    no hover, so tapping a block selects it instead of navigating: it applies
 *    the same cross-highlight and opens a brief-detail drawer, keeping the
 *    visitor on the board while they compare events. */
export default function ScheduleBoardGrid({ days, bands, legend, details }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ slug: string; session: string } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // The block that opened the drawer, so closing can hand focus back to it.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState]);

  const scrollByColumn = (direction: 1 | -1) => {
    const el = scrollerRef.current;
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
    // Desktop highlights on hover; touch highlights on the selected block.
    const active = compact ? (selected?.slug ?? null) : hovered;
    const faded = active !== null && active !== b.slug;
    const session = `${b.date}${b.start}`;
    const isSelected = compact && selected?.session === session;

    const body = (
      <>
        <span
          className={`block font-bold leading-tight tabular-nums ${
            compact ? "text-[10px]" : "text-[11px] tracking-wide"
          }`}
        >
          {compact ? b.start : `${b.start}–${b.end}`}
        </span>
        <span
          className={
            compact
              ? "line-clamp-3 break-words text-[11px] leading-tight"
              : "font-display text-sm leading-snug"
          }
        >
          {b.title}
        </span>
      </>
    );

    const shared = `block w-full min-w-0 text-left ${c.bg} ${c.on} transition-[transform,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
      faded ? "opacity-25" : ""
    }`;

    // Compact blocks are far too small to read, so a tap opens the drawer
    // rather than committing the visitor to a page they can't preview.
    if (compact) {
      return (
        <button
          key={`${b.slug}${b.start}`}
          type="button"
          // Marks this as a sheet trigger: tapping one while the drawer is open
          // swaps its contents instead of counting as a tap-outside dismiss.
          data-board-ticket=""
          aria-haspopup="dialog"
          aria-expanded={isSelected}
          onClick={(e) => {
            triggerRef.current = e.currentTarget;
            setSelected((prev) =>
              prev?.session === session ? null : { slug: b.slug, session },
            );
          }}
          className={`${shared} rounded-md p-1 ${
            isSelected ? "ring-2 ring-ink ring-offset-1" : ""
          }`}
        >
          {body}
        </button>
      );
    }

    return (
      <Link
        key={`${b.slug}${b.start}`}
        href={`/event/${b.slug}`}
        {...hoverHandlers(b.slug)}
        className={`${shared} rounded-lg p-2 hover:-translate-y-0.5`}
      >
        {body}
      </Link>
    );
  };

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
      {/* Mobile: the grid squeezed to the viewport — all days visible, mini tickets. */}
      <div className="sm:hidden">
        <p className="mb-2 text-xs text-ink/50">{t("tapEventHint")}</p>
        <div
          className="grid gap-x-1.5"
          style={{ gridTemplateColumns: `1.75rem repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((day) => (
            <div key={day.date} className="border-b-[3px] border-peach pb-1 text-center text-ink">
              <span className="block text-[10px] leading-tight text-ink/55">{day.weekday}</span>
              <span className="block font-display text-base leading-tight">{day.dayNum}</span>
            </div>
          ))}

          {bands.map((band, bandIdx) => (
            <div key={band.label} className="contents">
              <div
                className={`pt-2 text-[10px] leading-tight text-ink/50 ${
                  bandIdx > 0 ? "border-t border-dashed border-ink/15" : ""
                }`}
              >
                {band.label}
              </div>
              {band.cells.map((blocks, i) => (
                <div
                  key={days[i].date}
                  className={`flex min-h-12 flex-col gap-1.5 py-1.5 ${
                    bandIdx > 0 ? "border-t border-dashed border-ink/15" : ""
                  }`}
                >
                  {blocks.map((b) => ticket(b, true))}
                </div>
              ))}
            </div>
          ))}
        </div>
        {legendRow}

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
      </div>

      {/* ≥sm: day × time-band grid with overflow affordances. */}
      <div className="hidden sm:block">
        <div className="relative">
          <div ref={scrollerRef} onScroll={updateScrollState} className="overflow-x-auto">
            <div
              className="grid gap-x-3"
              style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(11rem, 1fr))` }}
            >
              <div />
              {days.map((day) => (
                <div key={day.date} className="flex items-baseline gap-2 border-b-[3px] border-peach px-1 pb-2">
                  <span className="font-display text-3xl leading-none text-ink">{day.dayNum}</span>
                  <span className="text-xs leading-tight text-ink/55">
                    <span className="block text-sm text-ink">{day.weekday}</span>
                    {day.month}
                  </span>
                </div>
              ))}

              {bands.map((band, bandIdx) => (
                <div key={band.label} className="contents">
                  <div
                    className={`pt-3 text-sm text-ink/50 ${
                      bandIdx > 0 ? "border-t border-dashed border-ink/15" : ""
                    }`}
                  >
                    {band.label}
                  </div>
                  {band.cells.map((blocks, i) => (
                    <div
                      key={days[i].date}
                      className={`flex min-h-16 flex-col gap-3 px-1 py-3 ${
                        bandIdx > 0 ? "border-t border-dashed border-ink/15" : ""
                      }`}
                    >
                      {blocks.map((b) => ticket(b, false))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {canScroll.left && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center bg-gradient-to-r from-paper to-transparent">
              <button
                type="button"
                aria-label={t("earlierDays")}
                onClick={() => scrollByColumn(-1)}
                className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/15 bg-paper text-lg text-ink shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                ←
              </button>
            </div>
          )}
          {canScroll.right && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-end bg-gradient-to-l from-paper to-transparent">
              <button
                type="button"
                aria-label={t("laterDays")}
                onClick={() => scrollByColumn(1)}
                className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/15 bg-paper text-lg text-ink shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                →
              </button>
            </div>
          )}
        </div>
        {legendRow}
      </div>
    </>
  );
}
