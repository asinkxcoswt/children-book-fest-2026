import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvents, getEvent, getCategory } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick, formatDate } from "@/lib/i18n";
import RegisterCta from "@/components/RegisterCta";
import Image from "next/image";

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

export default async function V3Event({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const category = getCategory(event.category);
  const c = tokenClasses(category?.color ?? "meadow");

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      {category && (
        <Link href={`/v3/category/${category.slug}`} className="text-sm text-ink/60 hover:underline">
          ← {pick(category.name)}
        </Link>
      )}
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{pick(event.title)}</h1>
      <p className="mt-2 text-lg text-ink/70">{pick(event.summary)}</p>

      {/* Gallery — placeholder blocks; swap to next/image when real artwork exists. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {event.gallery.map((img, i) => (
          <div
            key={i}
            role="img"
            aria-label={pick(img.alt)}
            className={`flex h-56 items-end rounded-2xl ${c.bg} p-2`}
          >
            <Image src={img.src} alt={pick(img.alt)} width={400} height={400} className="h-full w-full rounded-2xl object-cover" />
          </div>
        ))}
      </div>

      <article className="mt-8 text-lg leading-relaxed text-ink/85">{pick(event.description)}</article>

      {/* "You are here" wayfinding card — a nod to the map concept. */}
      <div className="mt-8 rounded-2xl border-2 border-ink/10 p-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-tomato" />
          <span className="font-display text-sm text-ink/60">{t("youAreHere")}</span>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/60">{t("when")}</dt>
            <dd className="text-ink">
              {formatDate(event.schedule.date)} · {event.schedule.start}–{event.schedule.end}
            </dd>
          </div>
          <div>
            <dt className="text-ink/60">{t("where")}</dt>
            <dd className="text-ink">{pick(event.schedule.venue)}</dd>
          </div>
          <div>
            <dt className="text-ink/60">{t("ages")}</dt>
            <dd className="text-ink">{event.ageRange}</dd>
          </div>
          {event.capacity && (
            <div>
              <dt className="text-ink/60">{t("capacity")}</dt>
              <dd className="text-ink">
                {event.capacity} {t("seats")}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-6">
          <RegisterCta url={event.registrationUrl} className="bg-meadow text-paper" />
        </div>
      </div>
    </main>
  );
}
