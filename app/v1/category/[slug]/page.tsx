import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getEventsByCategory } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";
import Image from "next/image";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export default async function V1Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const events = getEventsByCategory(slug);
  const c = tokenClasses(category.color);

  return (
    <main className="flex-1">
      <section className={`${c.bg}`}>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <Link href="/v1" className={`text-sm ${c.on} opacity-80 hover:underline`}>
            ← {t("backToHome")}
          </Link>
          <h1 className={`mt-4 font-display text-5xl ${c.on}`}>{pick(category.name)}</h1>
          <p className={`mt-3 max-w-xl text-lg ${c.on} opacity-90`}>{pick(category.description)}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-display text-2xl text-ink">{t("eventsInZone")}</h2>
        <ul className="mt-6 space-y-5">
          {events.map((ev) => (
            <li key={ev.slug}>
              <Link
                href={`/v1/event/${ev.slug}`}
                className="flex flex-col gap-4 rounded-2xl border-2 border-ink/10 p-4 transition-colors hover:border-ink/30 sm:flex-row sm:items-center"
              >
                <div aria-hidden className={`h-28 w-full shrink-0 rounded-xl ${c.bg} sm:w-44 p-2`} >
                  <Image src={ev.thumbnail} alt="" width={400} height={400} className="h-full w-full rounded-2xl object-cover" />
                </div>
                <span className="flex-1">
                  <span className="block font-display text-2xl text-ink">{pick(ev.title)}</span>
                  <span className="block text-ink/70">{pick(ev.summary)}</span>
                  <span className="mt-1 block text-sm text-ink/60">
                    {formatDate(ev.schedule.date)} · {ev.schedule.start}–{ev.schedule.end} ·{" "}
                    {pick(ev.schedule.venue)}
                  </span>
                </span>
                <span aria-hidden className={`font-display text-lg ${c.text}`}>
                  {t("viewEvent")} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
