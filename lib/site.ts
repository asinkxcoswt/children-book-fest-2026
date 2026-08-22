/** Absolute site origin — the single source for canonical URLs, the sitemap,
 *  robots.txt, and JSON-LD. Set NEXT_PUBLIC_SITE_URL in the deployment
 *  environment; localhost keeps previews working. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
