"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";

export interface BoardEventDetail {
  slug: string;
  title: string;
  summary: string;
  /** Localized category (zone) name. */
  category: string;
  color: ColorToken;
  venue: string;
  ageRange: string;
  /** Every occurrence, preformatted on the server. `key` is `${date}${start}`. */
  sessions: { key: string; label: string; time: string }[];
}

/** How far the sheet must be dragged down before releasing dismisses it. */
const DISMISS_PX = 90;
/** Matches the transition duration below — the slide-out before unmount. */
const EXIT_MS = 200;

/** Bottom sheet summarising the session tapped on the mobile schedule board.
 *  Deliberately NON-modal: no backdrop and no focus trap, so the board stays
 *  visible and tappable and visitors can hop from block to block without ever
 *  leaving the page. The detail page is one explicit tap away.
 *  Mounted only while a session is selected; switching sessions updates the
 *  content in place rather than remounting, so the slide-in plays once.
 *  Dismissed by swipe-down, the close button, or Escape — deliberately NOT by
 *  tapping outside: the board is a dense grid of small targets, so a stray tap
 *  while comparing events kept shutting the sheet mid-browse. */
export default function ScheduleEventDrawer({
  detail,
  currentSession,
  onClose,
}: {
  detail: BoardEventDetail;
  /** `${date}${start}` of the tapped session, marked in the session list. */
  currentSession: string;
  onClose: () => void;
}) {
  const c = tokenClasses(detail.color);
  const panelRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart = useRef<number | null>(null);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);

  // Slide in on mount. The rAF gives the browser one frame at the off-screen
  // start position, so the transition to translate-y-0 actually runs.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  /** Play the slide-out, then let the parent unmount us. */
  const dismiss = useCallback(() => {
    if (exitTimer.current) return;
    setDragY(0);
    setClosing(true);
    exitTimer.current = setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  /** Swipe down to dismiss. Only starts when the sheet is scrolled to the top,
   *  so dragging the content still scrolls it, and never from a control. */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" || closing) return;
    if ((e.target as Element).closest("a, button")) return;
    if ((panelRef.current?.scrollTop ?? 0) > 0) return;
    dragStart.current = e.clientY;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const delta = e.clientY - dragStart.current;
    // Downward only — an upward drag should scroll the sheet, not stretch it.
    if (delta <= 0 && dragY === 0) return;
    setDragY(Math.max(0, delta));
  };

  const endDrag = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragging(false);
    // Dropping back to translateY(0) with the transition restored springs it
    // shut or back into place, depending on how far it travelled.
    if (dragY > DISMISS_PX) dismiss();
    else setDragY(0);
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-labelledby="board-drawer-title"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // Untransitioned while the finger is down so the sheet tracks it 1:1.
      style={dragging ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      className={`fixed inset-x-0 bottom-0 z-40 max-h-[70svh] touch-pan-y overscroll-contain overflow-y-auto rounded-t-3xl border-t-2 border-ink/10 bg-paper pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.18)] transition-transform duration-200 ease-out focus:outline-none motion-reduce:transition-none ${
        shown && !closing ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {/* Zone spine, echoing the ticket blocks it was opened from. */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-2 rounded-tl-3xl ${c.bg}`} />

      <div className="pl-6 pr-4 pt-3">
        {/* Grab handle: the affordance for the swipe-down dismiss. */}
        <span aria-hidden className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-ink/20" />

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${c.bg} ${c.on}`}>
              {detail.category}
            </span>
            <h2 id="board-drawer-title" className="mt-2 font-display text-xl leading-snug text-ink">
              {detail.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("close")}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-ink/50 transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            ×
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-ink/75">{detail.summary}</p>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink/50">{t("where")}</dt>
          <dd className="text-ink">{detail.venue}</dd>
          <dt className="text-ink/50">{t("ages")}</dt>
          <dd className="text-ink">{detail.ageRange}</dd>
        </dl>

        {/* All occurrences — the touch replacement for the desktop hover
            cross-highlight, which tells you nothing without a pointer. */}
        <p className="mt-3 text-xs text-ink/50">{t("allSessions")}</p>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {detail.sessions.map((s) => {
            const isCurrent = s.key === currentSession;
            return (
              <li
                key={s.key}
                className={`rounded-full border-2 px-2.5 py-1 text-xs tabular-nums ${
                  isCurrent ? `${c.border} ${c.soft} text-ink` : "border-ink/10 text-ink/60"
                }`}
              >
                {s.label} · {s.time}
              </li>
            );
          })}
        </ul>

        <Link
          href={`/event/${detail.slug}`}
          className={`mt-4 block rounded-full px-5 py-3 text-center ${c.bg} ${c.on} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2`}
        >
          {t("viewEvent")} →
        </Link>
      </div>
    </div>
  );
}
