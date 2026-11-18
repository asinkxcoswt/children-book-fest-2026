import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategory, getEvent, getEvents } from "@/lib/content";
import { ogImage } from "@/lib/imageLoader";
import { t } from "@/lib/i18n";
import EventDetail from "@/components/EventDetail";

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

  return <EventDetail event={event} category={getCategory(event.category)} />;
}
