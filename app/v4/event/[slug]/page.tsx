import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvents, getEvent, getCategory, getSessionsByDate } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";
import RegisterCta from "@/components/RegisterCta";
import TicketPurchase from "@/components/v4/TicketPurchase";

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
  return { title: pick(event.title), description: pick(event.summary) };
}

export default async function V4Event({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const category = getCategory(event.category);
  const c = tokenClasses(category?.color ?? "peach");

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      {category && (
        <Link href={`/v4/category/${category.slug}`} className={`text-sm ${c.text} hover:underline`}>
          ← {pick(category.name)}
        </Link>
      )}
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{pick(event.title)}</h1>
      <p className="mt-2 text-lg text-ink/70">{pick(event.summary)}</p>

      {/* Gallery — v1's editorial spread. */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {event.gallery.map((img, i) => (
          <div key={i} className={`h-56 rounded-2xl ${c.bg} p-2`}>
            <Image
              src={img.src}
              alt={pick(img.alt)}
              width={400}
              height={400}
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-[1fr_18rem]">
        <article className="text-lg leading-relaxed text-ink/85">{pick(event.description)}</article>

        {/* v1's sidebar with v3's "you are here" wayfinding flavor. */}
        <aside className="h-fit rounded-2xl border-2 border-ink/10 p-6">
          <div className="mb-4 inline-flex items-center gap-1 rounded-full border-2 border-sunshine bg-paper px-3 py-1 text-xs text-ink">
            <span aria-hidden className="h-2 w-2 rounded-full bg-tomato" />
            {t("youAreHere")}
          </div>
          <dl className="space-y-4 text-sm">
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
          <div className="mt-6">
            {event.ticketEventCode ? (
              <TicketPurchase
                slug={event.slug}
                color={category?.color ?? "peach"}
                fallbackUrl={event.registrationUrl}
              />
            ) : (
              <RegisterCta url={event.registrationUrl} className={`${c.bg} ${c.on}`} />
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
