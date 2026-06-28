import Link from "next/link";
import { getCategories, getEventCount, getFeaturedEvents, getCategory } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";

/* Variant 1 — "Storybook Pages": editorial, soft peach washes, serif voice, chapter cards. */

export default function V1Home() {
  const categories = getCategories();
  const featured = getFeaturedEvents();

  return (
    <main className="flex-1">
      {/* Hero — a book "spread" */}
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
            href="#zones"
            className="mt-8 inline-block rounded-full bg-tomato px-7 py-3 text-lg text-paper transition-transform hover:scale-105"
          >
            {t("exploreEvents")} →
          </Link>
        </div>
      </section>

      {/* Chapter cards */}
      <section id="zones" className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-display text-3xl text-ink">{t("browseZones")}</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {categories.map((cat) => {
            const c = tokenClasses(cat.color);
            return (
              <Link
                key={cat.slug}
                href={`/v1/category/${cat.slug}`}
                className={`group block rounded-3xl ${c.bg} p-7 transition-transform hover:-translate-y-1`}
              >
                <p className={`font-display text-3xl ${c.on}`}>{pick(cat.name)}</p>
                <p className={`text-sm ${c.on} opacity-80`}>{cat.name.en}</p>
                <p className={`mt-3 ${c.on} opacity-90`}>{pick(cat.description)}</p>
                <p className={`mt-5 text-sm ${c.on} opacity-90`}>
                  {getEventCount(cat.slug)} {t("events")} →
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured events — magazine rows */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="font-display text-3xl text-ink">{t("featuredEvents")}</h2>
        <ul className="mt-8 space-y-5">
          {featured.map((ev) => {
            const cat = getCategory(ev.category);
            const c = tokenClasses(cat?.color ?? "peach");
            return (
              <li key={ev.slug}>
                <Link
                  href={`/v1/event/${ev.slug}`}
                  className="flex flex-col gap-4 rounded-2xl border-2 border-ink/10 p-4 transition-colors hover:border-ink/30 sm:flex-row sm:items-center"
                >
                  <span
                    aria-hidden
                    className={`h-28 w-full shrink-0 rounded-xl ${c.bg} sm:w-44`}
                  />
                  <span className="flex-1">
                    <span className={`font-display text-sm ${c.text}`}>
                      {cat && pick(cat.name)}
                    </span>
                    <span className="block font-display text-2xl text-ink">{pick(ev.title)}</span>
                    <span className="block text-ink/70">{pick(ev.summary)}</span>
                    <span className="mt-1 block text-sm text-ink/60">
                      {formatDate(ev.schedule.date)} · {ev.schedule.start} · {pick(ev.schedule.venue)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
