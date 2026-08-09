"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";

export interface BoardBlock {
  slug: string;
  title: string;
  start: string;
  end: string;
  color: ColorToken;
}

interface Props {
  /** Column headers, chronological. Labels are preformatted on the server —
   *  Intl output can differ between Node and the browser and would break hydration. */
  days: { date: string; label: string; weekday: string; dayNum: number }[];
  /** Row per time band; cells align with `days` order. */
  bands: { label: string; cells: BoardBlock[][] }[];
}

/** Presentational half of the schedule board.
 *  - ≥sm: day-column grid; when it overflows, edge fades + prev/next buttons
 *    make the hidden days obvious. Hovering/focusing a block fades every other
 *    event so all sessions of the same event stand out.
 *  - <sm: the same calendar grid compressed to fit the viewport (à la Google
 *    Calendar mobile): every day column visible, mini blocks with start time
 *    and a clamped title, no horizontal scrolling. */
export default function ScheduleBoardGrid({ days, bands }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
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

  const blockClasses = (b: BoardBlock) => {
    const c = tokenClasses(b.color);
    const faded = hovered !== null && hovered !== b.slug;
    return `block rounded-lg ${c.bg} p-2 text-sm leading-snug ${c.on} transition-[transform,opacity] hover:-translate-y-0.5 ${
      faded ? "opacity-25" : ""
    }`;
  };

  const hoverHandlers = (slug: string) => ({
    onMouseEnter: () => setHovered(slug),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(slug),
    onBlur: () => setHovered(null),
  });

  return (
    <>
      {/* Mobile: the same grid squeezed to the viewport — all days visible,
          mini blocks like Google Calendar's month/week view. */}
      <div
        className="grid gap-1 sm:hidden"
        style={{ gridTemplateColumns: `1.75rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div key={day.date} className="rounded-lg bg-peach py-1 text-center text-ink">
            <span className="block text-[10px] leading-tight">{day.weekday}</span>
            <span className="block font-display text-sm leading-tight">{day.dayNum}</span>
          </div>
        ))}

        {bands.map((band) => (
          <div key={band.label} className="contents">
            <div className="pt-2 text-[10px] leading-tight text-ink/50">{band.label}</div>
            {band.cells.map((blocks, i) => (
              <div
                key={days[i].date}
                className="flex min-h-12 flex-col gap-1 rounded-lg bg-ink/[0.03] p-1"
              >
                {blocks.map((b) => {
                  const c = tokenClasses(b.color);
                  return (
                    <Link
                      key={`${b.slug}${b.start}`}
                      href={`/v4/event/${b.slug}`}
                      className={`block min-w-0 rounded-md ${c.bg} p-1 ${c.on}`}
                    >
                      <span className="block text-[9px] font-bold leading-tight tabular-nums">
                        {b.start}
                      </span>
                      <span className="line-clamp-3 break-words text-[10px] leading-tight">
                        {b.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ≥sm: day × time-band grid with overflow affordances. */}
      <div className="relative hidden sm:block">
        <div ref={scrollerRef} onScroll={updateScrollState} className="overflow-x-auto">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(11rem, 1fr))` }}
          >
            <div />
            {days.map((day) => (
              <div
                key={day.date}
                className="rounded-xl bg-peach px-3 py-2 text-center font-display text-ink"
              >
                {day.label}
              </div>
            ))}

            {bands.map((band) => (
              <div key={band.label} className="contents">
                <div className="pt-3 text-sm text-ink/50">{band.label}</div>
                {band.cells.map((blocks, i) => (
                  <div
                    key={days[i].date}
                    className="flex min-h-14 flex-col gap-2 rounded-xl bg-ink/[0.03] p-2"
                  >
                    {blocks.map((b) => (
                      <Link
                        key={`${b.slug}${b.start}`}
                        href={`/v4/event/${b.slug}`}
                        {...hoverHandlers(b.slug)}
                        className={blockClasses(b)}
                      >
                        <span className="font-display">{b.title}</span>
                        <span className="block text-xs opacity-85">
                          {b.start}–{b.end}
                        </span>
                      </Link>
                    ))}
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
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/15 bg-paper text-lg text-ink shadow-sm transition-transform hover:scale-110"
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
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/15 bg-paper text-lg text-ink shadow-sm transition-transform hover:scale-110"
            >
              →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
