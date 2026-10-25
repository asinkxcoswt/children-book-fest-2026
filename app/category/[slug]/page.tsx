import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getEventsByCategory, getSessionsByDate, hasSessionVenues } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { ogImage } from "@/lib/imageLoader";
import { t, formatDate, formatWeekday } from "@/lib/i18n";
import FestivalMap from "@/components/FestivalMap";
import SectionHeading from "@/components/SectionHeading";
import WaveEdge from "@/components/WaveEdge";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  const title = category.name;
  const description = category.description;
  return {
    title,
    description,
    alternates: { canonical: `/category/${slug}` },
    openGraph: {
      title,
      description,
      url: `/category/${slug}`,
      // Re-declared: a child openGraph replaces the layout's wholesale, so
      // siteName/locale would silently vanish from these pages otherwise.
      siteName: `${t("festivalName")} ${t("festivalYear")}`,
      locale: "th_TH",
      type: "website",
      images: [{ url: ogImage(category.thumbnail) }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage(category.thumbnail)] },
  };
}

export default async function V4Category({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const events = getEventsByCategory(slug);
  const c = tokenClasses(category.color);

  return (
    <main className="flex-1">
      {/* Chapter header: the zone's character standing on the colour band,
          plus orientation (event count, days this zone runs). */}
      <section className={`${c.bg}`}>
        <div className="mx-auto grid max-w-5xl gap-8 px-6 pb-10 pt-12 sm:grid-cols-[1fr_auto] sm:items-center sm:py-12">
          <div>
            <Link
              href="/"
              className={`text-sm ${c.on} opacity-80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2`}
            >
              ← {t("backToHome")}
            </Link>
            <h1 className={`mt-4 font-display text-5xl ${c.on}`}>{category.name}</h1>
            <p className={`mt-4 max-w-xl text-2xl ${c.on}`}>{category.tagline}</p>
            <p className={`mt-3 max-w-xl text-lg ${c.on} opacity-90`}>{category.description}</p>
            <Link
              href="#events"
              className="mt-6 inline-block rounded-full bg-paper px-7 py-3 text-lg text-ink transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              {events.length} {t("events")} →
            </Link>
          </div>

          <Image
            src={category.thumbnail}
            alt=""
            width={400}
            height={640}
            priority
            sizes="(min-width: 640px) 14rem, 10rem"
            className="mx-auto h-64 w-40 object-contain object-bottom drop-shadow-lg sm:h-80 sm:w-56"
          />
        </div>
      </section>
      <WaveEdge fill={`var(--color-${category.color})`} />

      {/* Wayfinding map, anchored to this zone. */}
      <section className="mx-auto max-w-5xl px-6 pt-10">
        <FestivalMap currentSlug={slug} />
      </section>

      <section id="events" className="mx-auto max-w-5xl scroll-mt-6 px-6 py-12">
        <SectionHeading title={t("eventsInZone")} />
        {events.length === 0 && (
          <p className="mt-6 rounded-2xl border-2 border-dashed border-ink/15 px-4 py-10 text-center font-display text-xl text-ink/60">
            {t("zoneComingSoon")}
          </p>
        )}
        <ul className="mt-6 space-y-5">
          {events.map((ev) => (
            <li key={ev.slug}>
              <Link
                href={`/event/${ev.slug}`}
                className="flex flex-col gap-4 rounded-2xl border-2 border-ink/10 p-4 transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 sm:flex-row sm:items-center"
              >
                <div aria-hidden className="w-full shrink-0 overflow-hidden rounded-xl border-2 border-ink/10 sm:w-44">
                  <Image
                    src={ev.thumbnail}
                    alt=""
                    width={400}
                    height={400}
                    sizes="(min-width: 640px) 11rem, 100vw"
                    className="h-auto w-full"
                  />
                </div>
                <span className="flex-1">
                  <span className="block font-display text-2xl text-ink">{ev.title}</span>
                  <span className="block text-ink/70">{ev.summary}</span>
                  <span className="mt-1 block text-sm text-ink/60">
                    {hasSessionVenues(ev)
                      ? // Rooms differ by date, so name each: "ห้อง A (28 พ.ย.), ห้อง B (10 ธ.ค.)"
                        getSessionsByDate(ev)
                          .map(({ date, venue }) => `${venue} (${formatDate(date)})`)
                          .join(", ")
                      : ev.schedule.venue}
                  </span>
                  {/* Day chips — one per day this event runs, with its start time.
                      The festival spans 16 days, so empty days are not drawn. */}
                  <span className="mt-3 flex flex-wrap gap-2">
                    {getSessionsByDate(ev).map(({ date, sessions }) => (
                      <span
                        key={date}
                        className={`w-16 min-w-16 shrink-0 rounded-xl border-2 py-1.5 text-center ${c.bg} ${c.border} ${c.on}`}
                      >
                        <span className="block text-[10px] leading-tight opacity-75">{formatWeekday(date)}</span>
                        <span className="block font-display text-lg leading-tight">{Number(date.slice(-2))}</span>
                        <span className="block text-[11px] font-bold leading-tight tabular-nums">
                          {sessions.length > 1 ? `${sessions[0].start} +${sessions.length - 1}` : sessions[0].start}
                        </span>
                      </span>
                    ))}
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
