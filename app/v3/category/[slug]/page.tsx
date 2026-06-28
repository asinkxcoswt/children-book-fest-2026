import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getEventsByCategory } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";
import type { FestivalEvent } from "@/types/content";
import FestivalMap from "@/components/FestivalMap";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

/** Group events by day so the listing reads like a schedule. */
function groupByDate(events: FestivalEvent[]): [string, FestivalEvent[]][] {
  const map = new Map<string, FestivalEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.schedule.date) ?? [];
    list.push(ev);
    map.set(ev.schedule.date, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default async function V3Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const c = tokenClasses(category.color);
  const days = groupByDate(getEventsByCategory(slug));

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <Link href="/v3" className="text-sm text-ink/60 hover:underline">
        ← {t("festivalMap")}
      </Link>

      <header className="mt-4 flex items-center gap-4">
        <span
          aria-hidden
          className={`flex h-16 w-16 items-center justify-center rounded-2xl ${c.bg} font-display text-3xl ${c.on}`}
        >
          {pick(category.name).charAt(0)}
        </span>
        <div>
          <h1 className="font-display text-4xl text-ink">{pick(category.name)}</h1>
          <p className="text-ink/70">{pick(category.description)}</p>
        </div>
      </header>

      <FestivalMap currentSlug={slug} />

      <div className="mt-10 space-y-8">
        {days.map(([date, events]) => (
          <section key={date}>
            <h2 className={`font-display text-xl ${c.text}`}>{formatDate(date)}</h2>
            <ul className="mt-3 divide-y-2 divide-ink/5 border-y-2 border-ink/5">
              {events.map((ev) => (
                <li key={ev.slug}>
                  <Link
                    href={`/v3/event/${ev.slug}`}
                    className="flex items-center gap-4 py-4 transition-colors hover:bg-ink/[0.03]"
                  >
                    <span className="w-20 shrink-0 font-display text-ink/70">
                      {ev.schedule.start}
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-lg text-ink">{pick(ev.title)}</span>
                      <span className="block text-sm text-ink/60">{pick(ev.schedule.venue)}</span>
                    </span>
                    <span aria-hidden className={`${c.text}`}>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
