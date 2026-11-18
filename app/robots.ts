import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Required for `output: "export"`: metadata routes are written once at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API routes carry no indexable content; previews are unpublished
      // proposals (the page also says noindex).
      disallow: ["/api/", "/preview"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
