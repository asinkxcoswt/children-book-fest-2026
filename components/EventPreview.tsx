"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Category, FestivalEvent } from "@/types/content";
import { eventFromPreview, fetchPreview, ticketsFromPreview, type PreviewResult } from "@/lib/previewApi";
import { t } from "@/lib/i18n";
import EventDetail from "@/components/EventDetail";

/** What the organizer sees when CowTicket's "preview" button sends them here
 *  with ?preview=<token>: the event page drawn with their proposed changes,
 *  under a banner saying it is not live. Fetched on load, never cached. */
export default function EventPreview({
  events,
  categories,
}: {
  /** Every event the site was built with, keyed by ticketEventCode. */
  events: Record<string, FestivalEvent>;
  categories: Category[];
}) {
  const token = useSearchParams().get("preview");
  const [result, setResult] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchPreview(token).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Memoised on the response: a fresh object each render would reload the
  // purchase box and drop the organizer's picks.
  const tickets = useMemo(
    () => (result?.kind === "ok" ? ticketsFromPreview(result.page) : undefined),
    [result],
  );

  if (!token) return <Notice>{t("previewMissingToken")}</Notice>;
  if (!result) return <Notice>{t("previewLoading")}</Notice>;
  if (result.kind === "invalid") return <Notice>{t("previewInvalid")}</Notice>;
  if (result.kind === "rateLimited") return <Notice>{t("previewRateLimited")}</Notice>;
  if (result.kind === "error") return <Notice>{t("previewError")}</Notice>;

  const { page } = result;
  const base = events[page.event.eventCode];
  const event = eventFromPreview(page, base);
  const category = categories.find((c) => c.slug === event.category);
  const status = page.preview.status;

  return (
    <>
      <div role="status" className="border-b-2 border-ink bg-sunshine px-6 py-3 text-center text-ink">
        <p className="font-display text-lg">
          {status === "PENDING"
            ? t("previewPending")
            : status === "APPLIED"
              ? t("previewApplied")
              : t("previewNotUsed")}
        </p>
        {!base && <p className="text-sm">{t("previewNewEvent")}</p>}
      </div>
      <EventDetail event={event} category={category} tickets={tickets} />
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl flex-1 px-6 py-24 text-center">
      <p role="status" className="font-display text-xl text-ink">
        {children}
      </p>
    </main>
  );
}
