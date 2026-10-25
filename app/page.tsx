import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCategories, getEventCount, getEvents, getFestivalDates } from "@/lib/content";
import { SITE_URL } from "@/lib/site";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";
import FestivalMap from "@/components/FestivalMap";
import ScheduleBoard from "@/components/ScheduleBoard";
import SectionHeading from "@/components/SectionHeading";

/* Home — the client's stage banner on top, then the playful explorable
 * festival map as the centerpiece navigation. */

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function V4Home() {
  const categories = getCategories();
  const dates = getFestivalDates();
  // Festival-level structured data. Google event rich results also want a
  // `location` (venue name + address) — add it here once the client confirms
  // the real venue; per-event JSON-LD waits until event data is no longer mock.
  const festivalJsonLd = {
    "@context": "https://schema.org",
    "@type": "Festival",
    name: `${t("festivalName")} ${t("festivalYear")}`,
        description: t("heroBody"),
    inLanguage: "th",
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: [`${SITE_URL}/og/festival-share.png`],
    url: SITE_URL,
  };
  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(festivalJsonLd) }}
      />
      {/* Hero — the client's stage banner, wide from `sm` up and the portrait
          version on phones. Both carry the painted title, so the heading is
          visually hidden and kept for screen readers and search. */}
      <section className="bg-paper">
        {/* The banner's edges are the red curtain, so a tomato band behind it
            carries the curtains to the viewport edges; the ink rule below is
            the stage floor continuing. */}
        <div className="border-b-[10px] border-ink/80 bg-tomato">
          <div className="mx-auto max-w-5xl">
            <Image
              src="/content/banner.png"
              alt=""
              width={3090}
              height={1356}
              priority
              sizes="(min-width: 1024px) 64rem, 100vw"
              className="hidden h-auto w-full sm:block"
            />
            <Image
              src="/content/banner-portrait.png"
              alt=""
              width={3508}
              height={4961}
              priority
              sizes="100vw"
              className="h-auto w-full sm:hidden"
            />
          </div>
        </div>
        <div className="relative mx-auto max-w-5xl px-6 pb-12 pt-16">
          <h1 className="sr-only">{t("theme")}</h1>
          {/* The festival dates as a ticket stuck on the stage floor — the one
              fact the banner lacks. Editorial copy (content/ui.json), not derived
              from the programme, so it can state the full run. */}
          <p className="absolute -top-6 left-6 inline-block -rotate-2 rounded-xl border-2 border-ink bg-sunshine px-5 py-2 font-display text-xl tracking-wide text-ink shadow-[3px_3px_0_var(--color-ink)] sm:left-8 sm:text-2xl">
            {t("festivalDates")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="#map"
              className="inline-block rounded-full bg-tomato px-7 py-3 text-lg text-paper transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              {t("exploreEvents")} →
            </Link>
            <Link
              href="#programme"
              className="inline-block rounded-full border-2 border-ink/20 px-7 py-3 text-lg text-ink transition-colors hover:border-ink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              {t("programmeByDay")} →
            </Link>
          </div>
        </div>
      </section>

      {/* The playful village map as primary zone navigation. */}
      <section id="map" className="mx-auto max-w-5xl px-6 pt-14">
        <SectionHeading title={t("festivalMap")} />
        <FestivalMap />
      </section>

      {/* Chapter cards — editorial tiles with zone illustrations and a playful tilt. */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeading title={t("browseZones")} />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {categories.map((cat, i) => {
            const c = tokenClasses(cat.color);
            return (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={`group block rounded-3xl ${c.bg} p-7 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
                  i % 2 ? "hover:rotate-1" : "hover:-rotate-1"
                }`}
              >
                <div className="flex items-end gap-5">
                  {/* Zone character: a cut-out standing on the card, not a framed thumbnail. */}
                  <Image
                    src={cat.thumbnail}
                    alt=""
                    width={160}
                    height={260}
                    sizes="7rem"
                    className="h-40 w-28 shrink-0 object-contain object-bottom drop-shadow-md transition-transform group-hover:scale-105"
                  />
                  <div className="pb-2">
                    <p className={`font-display text-3xl ${c.on}`}>{cat.name}</p>
                  </div>
                </div>
                <p className={`mt-4 text-lg ${c.on}`}>{cat.tagline}</p>
                <p className={`mt-2 ${c.on} opacity-90`}>{cat.description}</p>
                <p className={`mt-4 text-sm ${c.on} opacity-90`}>
                  {getEventCount(cat.slug)} {t("events")} · {t("enterZone")} →
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Whole-festival schedule board — the date is the primary axis. */}
      <section id="programme" className="mx-auto max-w-5xl px-6 pb-20 scroll-mt-6">
        <SectionHeading title={t("programmeByDay")} />
        <div className="mt-8">
          <ScheduleBoard events={getEvents()} />
        </div>
      </section>
    </main>
  );
}
