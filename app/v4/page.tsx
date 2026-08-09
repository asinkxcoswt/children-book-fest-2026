import Link from "next/link";
import Image from "next/image";
import { getCategories, getEventCount, getEvents } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick } from "@/lib/i18n";
import FestivalMap from "@/components/FestivalMap";
import ScheduleBoard from "@/components/v4/ScheduleBoard";
import SectionHeading from "@/components/v4/SectionHeading";

/* Variant 4 — "Storybook Village": v1's editorial storybook UI (soft peach washes,
 * serif voice, chapter cards, magazine rows) combined with v3's playful explorable
 * festival map as the centerpiece navigation. */

export default function V4Home() {
  const categories = getCategories();

  return (
    <main className="flex-1">
      {/* Hero — v1's book "spread", now inviting you to the village map. */}
      <section className="bg-peach/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="font-display text-lg tracking-wide text-tomato">
            {t("festivalName")} · {t("festivalYear")}
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-5xl leading-tight text-ink sm:text-6xl">
            {t("tagline")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink/75">{t("heroBody")}</p>
          <Link
            href="#map"
            className="mt-8 inline-block rounded-full bg-tomato px-7 py-3 text-lg text-paper transition-transform hover:scale-105"
          >
            {t("exploreEvents")} →
          </Link>
        </div>
      </section>

      {/* The playful village map (from v3) as primary zone navigation. */}
      <section id="map" className="mx-auto max-w-5xl px-6 pt-14">
        <SectionHeading title={t("festivalMap")} caption={t("festivalMap", "en")} />
        <FestivalMap basePath="/v4" />
      </section>

      {/* Chapter cards — v1's editorial tiles, now with zone illustrations and a playful tilt. */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeading title={t("browseZones")} caption={t("browseZones", "en")} />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {categories.map((cat, i) => {
            const c = tokenClasses(cat.color);
            return (
              <Link
                key={cat.slug}
                href={`/v4/category/${cat.slug}`}
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
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeading title={t("programmeByDay")} caption={t("programmeByDay", "en")} />
        <div className="mt-8">
          <ScheduleBoard events={getEvents()} />
        </div>
      </section>
    </main>
  );
}
