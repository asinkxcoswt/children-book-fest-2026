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
import WaveEdge from "@/components/WaveEdge";

/* Home — "Storybook Village": an editorial storybook UI with the playful
 * explorable festival map as the centerpiece navigation. */

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
  // Sticker-fan positions for the zone illustrations (percent-based so the
  // cluster scales between mobile and desktop).
  const fan = [
    { left: "0%", top: "8%", tilt: "-rotate-6" },
    { left: "34%", top: "0%", tilt: "rotate-3" },
    { left: "62%", top: "16%", tilt: "rotate-6" },
    { left: "22%", top: "42%", tilt: "-rotate-3" },
  ];

  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(festivalJsonLd) }}
      />
      {/* Hero — a book cover: title, dates, and the zone art fanned like a
          hand of picture books. */}
      <section className="bg-peach/60">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 pb-12 pt-16 sm:grid-cols-[1fr_auto] sm:items-center sm:py-16">
          <div>
            <p className="font-display text-lg tracking-wide text-tomato">{t("festivalName")}</p>
            <h1 className="mt-3 max-w-2xl font-display text-5xl leading-tight text-ink sm:text-6xl">
              {t("tagline")}
            </h1>
            <p className="mt-4 inline-block rounded-lg border-2 border-dashed border-ink/40 px-4 py-1.5 font-display text-lg tracking-widest text-ink">
              {dateStamp}
            </p>
            <p className="mt-4 max-w-xl text-lg text-ink/75">{t("heroBody")}</p>
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

          {/* Zone illustrations fanned as pasted stickers. Decorative — the
              zones are properly linked in the sections below. */}
          <div aria-hidden className="relative mx-auto h-44 w-full max-w-xs sm:h-80 sm:w-72">
            {categories.slice(0, 4).map((cat, i) => (
              <div
                key={cat.slug}
                className={`absolute w-24 rounded-2xl border-2 border-ink bg-paper p-1.5 shadow-md sm:w-36 ${fan[i].tilt}`}
                style={{ left: fan[i].left, top: fan[i].top }}
              >
                <Image
                  src={cat.thumbnail}
                  alt=""
                  width={132}
                  height={99}
                  className="block h-auto w-full rounded-xl object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
      <WaveEdge fill="var(--color-peach)" opacity={0.6} />

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
                <div className="flex items-start gap-5">
                  <div className="w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-paper transition-transform group-hover:scale-105">
                    <Image
                      src={cat.thumbnail}
                      alt=""
                      width={132}
                      height={99}
                      className="block h-auto w-full object-cover"
                    />
                  </div>
                  <div>
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
