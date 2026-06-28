import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getEventsByCategory } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export default async function V2Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const events = getEventsByCategory(slug);
  const c = tokenClasses(category.color);

  return (
    <main className="flex-1">
      <section className={`border-b-4 border-ink ${c.bg} px-6 py-14`}>
        <div className="mx-auto max-w-5xl">
          <Link href="/v2" className={`text-sm ${c.on} hover:underline`}>
            ← {t("backToHome")}
          </Link>
          <h1 className={`mt-3 font-display text-5xl ${c.on}`}>{pick(category.name)}</h1>
          <p className={`mt-2 max-w-xl ${c.on} opacity-90`}>{pick(category.description)}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-display text-2xl text-ink">{t("eventsInZone")}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <Link
              key={ev.slug}
              href={`/v2/event/${ev.slug}`}
              className="flex flex-col overflow-hidden rounded-2xl border-4 border-ink bg-paper transition-transform hover:-translate-y-1"
            >
              <span aria-hidden className={`h-28 border-b-4 border-ink ${c.bg}`} />
              <span className="flex flex-1 flex-col p-4">
                <span className="font-display text-xl text-ink">{pick(ev.title)}</span>
                <span className="text-sm text-ink/70">{pick(ev.summary)}</span>
                <span className="mt-2 text-xs text-ink/60">
                  {formatDate(ev.schedule.date)} · {ev.schedule.start}–{ev.schedule.end}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
