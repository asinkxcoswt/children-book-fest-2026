import Link from "next/link";
import { getCategories, getEventCount, getFeaturedEvents, getCategory } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";

/* Variant 2 — "Crayon Blocks": flat saturated panels, thick ink outlines, chunky shapes. */

export default function V2Home() {
  const categories = getCategories();
  const featured = getFeaturedEvents();

  return (
    <main className="flex-1">
      {/* Hero block */}
      <section className="border-b-4 border-ink bg-sky px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="font-display text-lg text-paper">
            {t("festivalName")} · {t("festivalYear")}
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-5xl leading-[1.05] text-paper sm:text-7xl">
            {t("tagline")}
          </h1>
          <Link
            href="#zones"
            className="mt-7 inline-block rounded-xl border-4 border-ink bg-sunshine px-7 py-3 text-lg font-medium text-ink transition-transform hover:-translate-y-0.5"
          >
            {t("exploreEvents")} →
          </Link>
        </div>
      </section>

      {/* Color-block category grid */}
      <section id="zones" className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-display text-3xl text-ink">{t("browseZones")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => {
            const c = tokenClasses(cat.color);
            return (
              <Link
                key={cat.slug}
                href={`/v2/category/${cat.slug}`}
                className={`flex min-h-44 flex-col rounded-2xl border-4 border-ink ${c.bg} p-5 transition-transform hover:-translate-y-1`}
              >
                <span className={`font-display text-2xl ${c.on}`}>{pick(cat.name)}</span>
                <span className={`text-sm ${c.on} opacity-80`}>{cat.name.en}</span>
                <span className={`mt-auto pt-4 text-sm ${c.on}`}>
                  {getEventCount(cat.slug)} {t("events")} →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured event cards */}
      <section className="bg-peach px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl text-ink">{t("featuredEvents")}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((ev) => {
              const cat = getCategory(ev.category);
              const c = tokenClasses(cat?.color ?? "sunshine");
              return (
                <Link
                  key={ev.slug}
                  href={`/v2/event/${ev.slug}`}
                  className="flex flex-col overflow-hidden rounded-2xl border-4 border-ink bg-paper transition-transform hover:-translate-y-1"
                >
                  <span className={`border-b-4 border-ink ${c.bg} px-4 py-2 text-sm ${c.on}`}>
                    {cat && pick(cat.name)}
                  </span>
                  <span aria-hidden className={`h-28 border-b-4 border-ink ${c.bg} opacity-60`} />
                  <span className="flex flex-1 flex-col p-4">
                    <span className="font-display text-xl text-ink">{pick(ev.title)}</span>
                    <span className="text-sm text-ink/70">{pick(ev.summary)}</span>
                    <span className="mt-2 text-xs text-ink/60">
                      {formatDate(ev.schedule.date)} · {ev.schedule.start}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
