import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvents, getEvent, getCategory, getSessionsByDate } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { ogImage } from "@/lib/imageLoader";
import { t, pick, formatDate } from "@/lib/i18n";
import TicketPurchase from "@/components/TicketPurchase";
import WalkInNotice from "@/components/WalkInNotice";
import ShareButton from "@/components/ShareButton";

export function generateStaticParams() {
  return getEvents().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) return {};
  const title = pick(event.title);
  const description = pick(event.summary);
  return {
    title,
    description,
    alternates: { canonical: `/event/${slug}` },
    openGraph: {
      title,
      description,
      url: `/event/${slug}`,
      // Re-declared: a child openGraph replaces the layout's wholesale, so
      // siteName/locale would silently vanish from these pages otherwise.
      siteName: `${t("festivalName")} ${t("festivalYear")}`,
      locale: "th_TH",
      images: [{ url: ogImage(event.thumbnail) }],
      type: "article",
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage(event.thumbnail)] },
  };
}

export default async function V4Event({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const category = getCategory(event.category);
  const c = tokenClasses(category?.color ?? "peach");
  // The poster sits at the top; anything else in the gallery goes below the details.
  const gallery = event.gallery.filter((img) => img.src !== event.thumbnail);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      {category && (
        <Link href={`/category/${category.slug}`} className={`text-sm ${c.text} hover:underline`}>
          ← {pick(category.name)}
        </Link>
      )}
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{pick(event.title)}</h1>
      <p className="mt-2 text-lg text-ink/70">{pick(event.summary)}</p>

      {/* Primary poster — shown at its own aspect ratio, never cropped — with
          the event's mascot, when it has one, standing beside it. */}
      <div className="mt-8 flex items-end gap-4 sm:gap-8">
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border-2 border-ink/10 sm:max-w-xl">
          <Image
            src={event.thumbnail}
            alt={pick(event.title)}
            width={1200}
            height={1200}
            priority
            sizes="(min-width: 640px) 36rem, 100vw"
            className="h-auto w-full"
          />
        </div>
        {event.mascot && (
          <Image
            src={event.mascot}
            alt=""
            width={300}
            height={480}
            sizes="(min-width: 640px) 12rem, 7rem"
            className="h-44 w-28 shrink-0 object-contain object-bottom drop-shadow-lg sm:h-72 sm:w-48"
          />
        )}
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-[1fr_18rem]">
        <div>
          <article className="text-lg leading-relaxed text-ink/85">{pick(event.description)}</article>

          {/* Practical details live with the content; the sidebar stays transactional. */}
          <dl className="mt-8 grid gap-x-8 gap-y-5 border-t-[3px] border-peach pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-display text-ink/60">{t("when")}</dt>
              {getSessionsByDate(event).map(({ date, sessions }) => (
                <dd key={date} className="text-ink">
                  {formatDate(date)} · {sessions.map((s) => `${s.start}–${s.end}`).join(", ")}
                </dd>
              ))}
            </div>
            <div>
              <dt className="font-display text-ink/60">{t("where")}</dt>
              <dd className="text-ink">{pick(event.schedule.venue)}</dd>
            </div>
            <div>
              <dt className="font-display text-ink/60">{t("ages")}</dt>
              <dd className="text-ink">{event.ageRange}</dd>
            </div>
            {event.capacity && (
              <div>
                <dt className="font-display text-ink/60">{t("capacity")}</dt>
                <dd className="text-ink">
                  {event.capacity} {t("seats")}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <aside className="h-fit rounded-2xl border-2 border-ink/10 p-6">
          {/* Zone chip (names the color coding, links back to the zone) + share. */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink/10 bg-paper px-3 py-1 text-sm text-ink transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                <span aria-hidden className={`h-3 w-3 rounded border-2 border-ink ${c.bg}`} />
                {pick(category.name)}
              </Link>
            )}
            <ShareButton title={pick(event.title)} text={pick(event.summary)} />
          </div>
          <div>
            {event.walkIn ? (
              // Free walk-in event: nothing to sell, so no purchase UI and no
              // ticket API call — the answer to "how do I get in" is static.
              <WalkInNotice color={category?.color ?? "peach"} />
            ) : event.ticketEventCode ? (
              <TicketPurchase
                slug={event.slug}
                eventCode={event.ticketEventCode}
                color={category?.color ?? "peach"}
                // Wallet-pass text comes from our content — the platform
                // doesn't know the event's date or venue.
                pass={{
                  title: pick(event.title),
                  venue: pick(event.schedule.venue),
                  sessions: event.schedule.sessions,
                }}
              />
            ) : null}
          </div>
        </aside>
      </div>

      {/* Remaining gallery images, after the details, each at its own ratio. */}
      {gallery.length > 0 && (
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {gallery.map((img, i) => (
            <div key={`${i}-${img.src}`} className="overflow-hidden rounded-2xl border-2 border-ink/10">
              <Image
                src={img.src}
                alt={pick(img.alt)}
                width={1200}
                height={900}
                sizes="(min-width: 640px) 32rem, 100vw"
                className="h-auto w-full"
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
