import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCategories, getEventCount, getEvents, getFestivalDates } from "@/lib/content";
import { SITE_URL } from "@/lib/site";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatMonth } from "@/lib/i18n";
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
    alternateName: `${t("festivalName", "en")} ${t("festivalYear", "en")}`,
    description: t("heroBody"),
    inLanguage: "th",
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: [`${SITE_URL}/og/festival-share.png`],
    url: SITE_URL,
  };
  // "15–20 ส.ค. 2569" — from real data so the hero never goes stale.
  const dateStamp = `${Number(dates[0].slice(-2))}–${Number(dates[dates.length - 1].slice(-2))} ${formatMonth(dates[dates.length - 1])} ${t("festivalYear")}`;
  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(festivalJsonLd) }}
      />
      {/* Hero — the client's stage banner. The lettering is painted into the
          wide banner, so from `sm` up the heading is visually hidden and the
          image carries it; on phones the lettering would be unreadable, so a
          crop of the character cluster sits beside live text instead. */}
      <section className="bg-paper">
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
          <div className="grid grid-cols-[9rem_1fr] items-end gap-4 px-6 pt-8 sm:hidden">
            <Image
              src="/content/banner-mobile.png"
              alt=""
              width={1040}
              height={1356}
              priority
              sizes="9rem"
              className="h-auto w-full"
            />
            <p className="pb-4 font-display text-base leading-snug text-tomato">{t("festivalName")}</p>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-12 pt-6 sm:pt-10">
          <p className="inline-block rounded-full bg-bubblegum px-3 py-0.5 font-display text-sm text-paper sm:hidden">
            {t("episode")}
          </p>
          <h1 className="mt-2 font-display text-5xl leading-tight text-ink sm:sr-only">{t("theme")}</h1>
          <p className="mt-3 font-display text-2xl text-ink sm:mt-0 sm:text-3xl">{t("tagline")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="inline-block rounded-lg border-2 border-dashed border-ink/40 px-4 py-1.5 font-display text-lg tracking-widest text-ink">
              {dateStamp}
            </p>
            <p className="max-w-xl text-lg text-ink/75">{t("heroBody")}</p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
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
        <SectionHeading title={t("festivalMap")} caption={t("festivalMap", "en")} />
        <FestivalMap />
      </section>

      {/* Chapter cards — editorial tiles with zone illustrations and a playful tilt. */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeading title={t("browseZones")} caption={t("browseZones", "en")} />
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
                    <p className={`font-display text-3xl ${c.on}`}>{pick(cat.name)}</p>
                    <p className={`text-sm ${c.on} opacity-80`}>{cat.name.en}</p>
                  </div>
                </div>
                <p className={`mt-4 ${c.on} opacity-90`}>{pick(cat.description)}</p>
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
        <SectionHeading title={t("programmeByDay")} caption={t("programmeByDay", "en")} />
        <div className="mt-8">
          <ScheduleBoard events={getEvents()} />
        </div>
      </section>
    </main>
  );
}
