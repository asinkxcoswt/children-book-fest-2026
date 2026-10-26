import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategory, getEvent, getEvents, getSessionsByDate, hasSessionVenues, sessionVenue } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { ogImage } from "@/lib/imageLoader";
import { COW_TICKET_URL } from "@/lib/site";
import { t, formatDate } from "@/lib/i18n";
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
  const title = event.title;
  const description = event.summary;
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
  const perSessionVenue = hasSessionVenues(event);
  const c = tokenClasses(category?.color ?? "peach");
  // The poster sits at the top; anything else in the gallery goes below the details.
  const gallery = event.gallery.filter((img) => img.src !== event.thumbnail);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      {category && (
        <Link href={`/category/${category.slug}`} className={`text-sm ${c.text} hover:underline`}>
          ← {category.name}
        </Link>
      )}
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{event.title}</h1>
      <p className="mt-2 text-lg text-ink/70">{event.summary}</p>

      {/* Primary poster — shown at its own aspect ratio, never cropped. */}
      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10 sm:max-w-xl">
        <Image
          src={event.thumbnail}
          alt={event.title}
          width={1200}
          height={1200}
          priority
          sizes="(min-width: 640px) 36rem, 100vw"
          className="h-auto w-full"
        />
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-[1fr_18rem]">
        <div>
          <article className="whitespace-pre-line text-lg leading-relaxed text-ink/85">{event.description}</article>

          {/* Practical details live with the content; the sidebar stays transactional. */}
          <dl className="mt-8 grid gap-x-8 gap-y-5 border-t-[3px] border-peach pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-display text-ink/60">{t("when")}</dt>
              {getSessionsByDate(event).map(({ date, venue, sessions }) => (
                <dd key={`${date}${venue}`} className="text-ink">
                  {formatDate(date)} · {sessions.map((s) => `${s.start}–${s.end}`).join(", ")}
                  {/* Rooms are spelled out per date only when they differ. */}
                  {perSessionVenue && ` · ${venue}`}
                </dd>
              ))}
            </div>
            {!perSessionVenue && (
              <div>
                <dt className="font-display text-ink/60">{t("where")}</dt>
                <dd className="text-ink">{event.schedule.venue}</dd>
              </div>
            )}
            {event.presenter && (
              <div>
                <dt className="font-display text-ink/60">{t("presenter")}</dt>
                <dd className="text-ink">{event.presenter}</dd>
              </div>
            )}
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

        <aside className={`relative h-fit rounded-2xl border-2 border-ink/10 bg-paper p-6 ${event.mascot ? "mt-8 sm:mt-0" : ""}`}>
          {/* The event's mascot, when it has one, peeks over the top-right
              corner of the ticket box, feet on its top edge. */}
          {event.mascot && (
            <Image
              src={event.mascot}
              alt=""
              width={300}
              height={480}
              sizes="6rem"
              className="pointer-events-none absolute bottom-[calc(100%-0.75rem)] right-4 z-10 h-auto w-24 drop-shadow-md"
            />
          )}
          {/* Zone chip (names the color coding, links back to the zone) + share. */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink/10 bg-paper px-3 py-1 text-sm text-ink transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                <span aria-hidden className={`h-3 w-3 rounded border-2 border-ink ${c.bg}`} />
                {category.name}
              </Link>
            )}
            <ShareButton title={event.title} text={event.summary} />
          </div>
          <div>
            {event.admission !== "ticket" ? (
              // Free or donation-box event: nothing to sell, so no purchase UI
              // and no ticket API call — "how do I get in" is static content.
              <WalkInNotice admission={event.admission} color={category?.color ?? "peach"} />
            ) : event.ticketEventCode ? (
              <TicketPurchase
                slug={event.slug}
                eventCode={event.ticketEventCode}
                color={category?.color ?? "peach"}
                // Wallet-pass text comes from our content — the platform
                // doesn't know the event's date or venue.
                pass={{
                  title: event.title,
                  sessions: event.schedule.sessions.map((s) => ({
                    ...s,
                    venueText: sessionVenue(event, s),
                  })),
                }}
              />
            ) : null}
          </div>
          {/* Ticketing credit — a quiet mark where the platform is in use. */}
          {event.admission === "ticket" && event.ticketEventCode && (
            <p className="mt-5 flex items-center gap-2 border-t-2 border-ink/10 pt-3 text-xs text-ink/60">
              <span>{t("ticketingBy")}</span>
              <a
                href={COW_TICKET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md font-display text-sm text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                <Image
                  src="/cow-ticket/cow-ticket-logo-transparent.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
                CowTicket ↗
              </a>
            </p>
          )}
        </aside>
      </div>

      {/* Remaining gallery images, after the details, each at its own ratio. */}
      {gallery.length > 0 && (
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {gallery.map((img, i) => (
            <div key={`${i}-${img.src}`} className="overflow-hidden rounded-2xl border-2 border-ink/10">
              <Image
                src={img.src}
                alt={img.alt}
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
