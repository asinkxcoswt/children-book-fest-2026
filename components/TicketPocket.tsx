"use client";

import { useEffect, useState } from "react";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";
import { drawTicket, type TicketDisplay } from "@/lib/ticketImage";

/** The order's tickets, fanned out of a paper pocket. Tap a ticket to bring
 *  the next one forward. One button saves every ticket PNG to the gallery.
 *  No wallet passes — the PNG + email are the ticket (guide §4.6). */
export default function TicketPocket({ tickets }: { tickets: TicketDisplay[] }) {
  const color = tickets[0]?.color ?? "bubblegum";
  const c = tokenClasses(color);

  const [images, setImages] = useState<string[] | null>(null);
  /** The same PNGs as File objects, prepared up front — see saveAll(). */
  const [files, setFiles] = useState<File[] | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [front, setFront] = useState(0);

  useEffect(() => {
    let alive = true;
    let objectUrls: string[] = [];
    // drawTicket waits for the typefaces it needs before it measures anything.
    Promise.all(tickets.map((tk) => drawTicket(tk)))
      .then((blobs) => {
        if (!alive) return;
        const asFiles = blobs.map(
          (blob, i) =>
            new File([blob], `ticket-${tickets[i].ticketNo}.png`, { type: "image/png" }),
        );
        objectUrls = blobs.map((blob) => URL.createObjectURL(blob));
        setImages(objectUrls);
        setFiles(asFiles);
        setCanShareFiles(navigator.canShare?.({ files: asFiles }) ?? false);
      })
      .catch(() => {});
    return () => {
      alive = false;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [tickets]);

  /** iOS has no API for writing to the photo library: an <a download> always
   *  lands in Files behind a confirmation prompt. The share sheet does offer
   *  "Save Image", so prefer it and keep the download as the fallback.
   *  The Files are built ahead of time because Safari only honours share()
   *  when it is reached synchronously from the tap — an await first loses the
   *  user gesture and throws NotAllowedError. */
  async function saveAll() {
    if (files && canShareFiles) {
      try {
        await navigator.share({ files });
        return;
      } catch (err) {
        // Dismissing the sheet is a choice, not a failure — don't then download.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    images?.forEach((url, i) => {
      // Staggered clicks so the browser accepts every download.
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `ticket-${tickets[i].ticketNo}.png`;
        a.click();
      }, i * 350);
    });
  }

  if (!images) {
    return (
      <div
        className={`mx-auto aspect-[32/45] w-full max-w-xs animate-pulse rounded-3xl ${c.soft}`}
        role="status"
        aria-label={t("loadingTickets")}
      />
    );
  }

  const many = tickets.length > 1;

  return (
    <div className="mx-auto w-full max-w-sm">
      {/* The pocket: fanned tickets tucked into a paper sleeve. */}
      <div className="relative mx-auto max-w-xs" style={{ paddingBottom: many ? "3.5rem" : "2.5rem" }}>
        <div className="relative aspect-[32/45]">
          {images.map((url, i) => {
            // Depth = position in the fan, front card on top.
            const depth = (i - front + tickets.length) % tickets.length;
            const isFront = depth === 0;
            return (
              <button
                key={tickets[i].ticketNo}
                type="button"
                aria-label={`${t("ticketAlt")} — ${tickets[i].principal}${many ? ` (${i + 1}/${tickets.length})` : ""}`}
                onClick={() => many && setFront((f) => (f + 1) % tickets.length)}
                disabled={!many}
                className="absolute inset-0 transition-transform duration-300 ease-out"
                style={{
                  zIndex: tickets.length - depth,
                  transform: many
                    ? `translateY(${depth * -14}px) rotate(${depth === 0 ? 0 : depth % 2 ? -4 : 4}deg) scale(${1 - depth * 0.04})`
                    : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- canvas data URL, not an optimizable asset */}
                <img
                  src={url}
                  alt=""
                  className={`w-full rounded-3xl border-2 shadow-lg ${
                    isFront ? "border-ink/15" : "border-ink/10 opacity-90"
                  }`}
                />
              </button>
            );
          })}

          {/* Paper sleeve — a low lip at the bottom of the stack, kept clear of
              the ticket's info panel so title/date/number stay sharp. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute -inset-x-3 -bottom-8 top-[97%] z-20 rounded-b-3xl rounded-t-[2rem] border-2 border-ink/10 bg-paper`}
            style={{ boxShadow: "0 -6px 12px -8px rgba(0,0,0,0.25) inset" }}
          />
          {many && (
            <span
              className={`absolute -bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-paper px-3 py-0.5 font-display text-sm ${c.bg} ${c.on}`}
            >
              {((front % tickets.length) + 1)} / {tickets.length}
            </span>
          )}
        </div>
      </div>

      {many && <p className="mt-4 text-center text-xs text-ink/50">{t("nextTicket")}</p>}

      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={saveAll}
          className={`inline-flex items-center gap-2 rounded-full px-7 py-3 text-lg ${c.bg} ${c.on} transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2`}
        >
          {many ? t("saveAllTickets") : t("saveTicket")} ↓
        </button>
        {/* "Save Image" sits among Messages/AirDrop in the sheet — point at it. */}
        {canShareFiles && (
          <p className="max-w-xs text-center text-xs text-ink/60">{t("saveTicketHint")}</p>
        )}
      </div>
    </div>
  );
}
