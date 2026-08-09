import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getEventsByCategory, getFestivalDates } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatWeekday } from "@/lib/i18n";
import FestivalMap from "@/components/FestivalMap";
import SectionHeading from "@/components/v4/SectionHeading";
import WaveEdge from "@/components/v4/WaveEdge";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  const title = pick(category.name);
  const description = pick(category.description);
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: category.thumbnail }] },
    twitter: { card: "summary_large_image", title, description, images: [category.thumbnail] },
  };
}

export default async function V4Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const events = getEventsByCategory(slug);
  const c = tokenClasses(category.color);
  const festivalDates = getFestivalDates();

  return (
    <main className="flex-1">
      {/* Chapter header as a book cover: zone art framed like a sticker on the
          color band, plus orientation chips (event count, days this zone runs). */}
      <section className={`${c.bg}`}>
        <div className="mx-auto grid max-w-5xl gap-8 px-6 pb-10 pt-12 sm:grid-cols-[1fr_auto] sm:items-center sm:py-12">
          <div>
            <Link
              href="/v4"
              className={`text-sm ${c.on} opacity-80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2`}
            >
              ← {t("backToHome")}
            </Link>
            <h1 className={`mt-4 font-display text-5xl ${c.on}`}>{pick(category.name)}</h1>
            <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${c.on} opacity-70`}>
              {category.name.en}
            </p>
            <p className={`mt-4 max-w-xl text-lg ${c.on} opacity-90`}>{pick(category.description)}</p>
            <Link
              href="#events"
              className="mt-6 inline-block rounded-full bg-paper px-7 py-3 text-lg text-ink transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              {events.length} {t("events")} →
            </Link>
          </div>

          <div aria-hidden className="mx-auto w-40 rotate-3 rounded-2xl border-2 border-ink bg-paper p-2 shadow-md sm:w-52">
            <Image
              src={category.thumbnail}
              alt=""
              width={264}
              height={198}
              className="block h-auto w-full rounded-xl object-cover"
            />
          </div>
        </div>
      </section>
      <WaveEdge fill={`var(--color-${category.color})`} />

      {/* v3's wayfinding map, anchored to this zone. */}
      <section className="mx-auto max-w-5xl px-6 pt-10">
        <FestivalMap currentSlug={slug} basePath="/v4" />
      </section>

      <section id="events" className="mx-auto max-w-5xl scroll-mt-6 px-6 py-12">
        <SectionHeading title={t("eventsInZone")} caption={t("eventsInZone", "en")} />
        <ul className="mt-6 space-y-5">
          {events.map((ev) => (
            <li key={ev.slug}>
              <Link
                href={`/v4/event/${ev.slug}`}
                className="flex flex-col gap-4 rounded-2xl border-2 border-ink/10 p-4 transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 sm:flex-row sm:items-center"
              >
                <div aria-hidden className={`h-28 w-full shrink-0 rounded-xl ${c.bg} p-2 sm:w-44`}>
                  <Image
                    src={ev.thumbnail}
                    alt=""
                    width={400}
                    height={400}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                </div>
                <span className="flex-1">
                  <span className="block font-display text-2xl text-ink">{pick(ev.title)}</span>
                  <span className="block text-ink/70">{pick(ev.summary)}</span>
                  <span className="mt-1 block text-sm text-ink/60">{pick(ev.schedule.venue)}</span>
                  {/* Mini calendar strip — every card shares the same 3-day shape;
                      days this event runs light up with their start times. */}
                  <span className="mt-3 flex flex-wrap gap-2">
                    {festivalDates.map((date) => {
                      const daySessions = ev.schedule.sessions.filter((s) => s.date === date);
                      const active = daySessions.length > 0;
                      return (
                        <span
                          key={date}
                          className={`w-16 min-w-16 shrink-0 rounded-xl border-2 py-1.5 text-center ${
                            active ? `${c.bg} ${c.border} ${c.on}` : "border-ink/10 text-ink/30"
                          }`}
                        >
                          <span className="block text-[10px] leading-tight opacity-75">{formatWeekday(date)}</span>
                          <span className="block font-display text-lg leading-tight">
                            {Number(date.slice(-2))}
                          </span>
                          <span className="block text-[11px] font-bold leading-tight tabular-nums">
                            {active
                              ? daySessions.length > 1
                                ? `${daySessions[0].start} +${daySessions.length - 1}`
                                : daySessions[0].start
                              : " "}
                          </span>
                        </span>
                      );
                    })}
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
