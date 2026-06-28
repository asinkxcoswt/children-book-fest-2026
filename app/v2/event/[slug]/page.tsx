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

export default async function V2Event({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  const category = getCategory(event.category);
  const c = tokenClasses(category?.color ?? "sunshine");

  return (
    <main className="flex-1">
      <section className={`border-b-4 border-ink ${c.bg} px-6 py-12`}>
        <div className="mx-auto max-w-5xl">
          {category && (
            <Link href={`/v2/category/${category.slug}`} className={`text-sm ${c.on} hover:underline`}>
              ← {pick(category.name)}
            </Link>
          )}
          <h1 className={`mt-3 font-display text-4xl ${c.on} sm:text-5xl`}>{pick(event.title)}</h1>
          <p className={`mt-2 text-lg ${c.on} opacity-90`}>{pick(event.summary)}</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Gallery — placeholder blocks; swap to next/image when real artwork exists. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {event.gallery.map((img, i) => (
            <div
              key={i}
              role="img"
              aria-label={pick(img.alt)}
              className={`flex h-56 items-end rounded-2xl border-4 border-ink ${c.bg} p-4 relative`}
            >
              <Image src={img.src} alt={pick(img.alt)} width={400} height={400} className="h-full w-full rounded-2xl object-cover" />
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-10 sm:grid-cols-[1fr_18rem]">
          <article className="text-lg leading-relaxed text-ink/85">{pick(event.description)}</article>

          <aside className="h-fit rounded-2xl border-4 border-ink bg-paper p-6">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-display text-ink/60">{t("when")}</dt>
                <dd className="text-ink">
                  {formatDate(event.schedule.date)} · {event.schedule.start}–{event.schedule.end}
                </dd>
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
              <RegisterCta
                url={event.registrationUrl}
                className="border-4 border-ink bg-sunshine text-ink"
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
