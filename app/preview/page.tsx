import { Suspense } from "react";
import type { Metadata } from "next";
import { getCategories, getEvents } from "@/lib/content";
import { t } from "@/lib/i18n";
import EventPreview from "@/components/EventPreview";

/** CowTicket's preview address for this project points here:
 *  /preview?preview=<token>. The token says which event it is, so one static
 *  page serves every event, including ones not on the site yet. */
export const metadata: Metadata = {
  title: t("previewTitle"),
  // A proposal, not the event: never indexed, never followed.
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  // The site's own copy of every event, so a preview of an existing event
  // keeps what CowTicket does not hold (mascot, alt text, every session).
  const events = Object.fromEntries(
    getEvents()
      .filter((e) => e.ticketEventCode)
      .map((e) => [e.ticketEventCode!, e]),
  );
  return (
    // useSearchParams needs a Suspense boundary in a static export.
    <Suspense>
      <EventPreview events={events} categories={getCategories()} />
    </Suspense>
  );
}
