import type { MetadataRoute } from "next";
import { getCategories, getEvents } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, priority: 1 },
    ...getCategories().map((c) => ({
      url: `${SITE_URL}/category/${c.slug}`,
      priority: 0.8,
    })),
    ...getEvents().map((e) => ({
      url: `${SITE_URL}/event/${e.slug}`,
      priority: 0.6,
    })),
  ];
}
