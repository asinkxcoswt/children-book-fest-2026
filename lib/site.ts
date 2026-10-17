/** Absolute site origin — the single source for canonical URLs, the sitemap,
 *  robots.txt, and JSON-LD. Set NEXT_PUBLIC_SITE_URL in the deployment
 *  environment; localhost keeps previews working. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** The ticketing platform behind the purchase box. Credited there (and only
 *  there) — the one place a visitor is looking at the product. */
export const COW_TICKET_URL = "https://cow-ticket.dev";
