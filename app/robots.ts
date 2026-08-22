import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API routes and the post-purchase flow carry no indexable content.
      disallow: ["/api/", "/checkout/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
