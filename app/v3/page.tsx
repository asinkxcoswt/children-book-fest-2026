import Link from "next/link";
import { getFeaturedEvents, getCategory } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";
import FestivalMap from "@/components/FestivalMap";

/* Variant 3 — "Friendly Map": the festival as a village; each zone is a place you visit. */

export default function V3Home() {
  const featured = getFeaturedEvents();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 py-12">
        <p className="font-display text-lg text-meadow">
          {t("festivalName")} · {t("festivalYear")}
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-tight text-ink">
          {t("tagline")}
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink/75">{t("heroBody")}</p>

        <FestivalMap />
      </section>

      {/* Featured events. */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="font-display text-3xl text-ink">{t("featuredEvents")}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {featured.map((ev) => {
            const cat = getCategory(ev.category);
            const c = tokenClasses(cat?.color ?? "meadow");
            return (
              <li key={ev.slug}>
                <Link
                  href={`/v3/event/${ev.slug}`}
                  className="flex items-center gap-4 rounded-2xl border-2 border-ink/10 p-4 transition-colors hover:border-ink/30"
                >
                  <span
                    aria-hidden
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${c.bg} font-display text-2xl ${c.on}`}
                  >
                    {pick(cat!.thumbnailLetter)}
                  </span>
                  <span className="flex-1">
                    <span className={`block font-display text-sm ${c.text}`}>
                      {cat && pick(cat.name)}
                    </span>
                    <span className="block font-display text-xl text-ink">{pick(ev.title)}</span>
                    <span className="block text-sm text-ink/70">{pick(ev.summary)}</span>
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
