/** Absolute site origin — the single source for canonical URLs, the sitemap,
 *  robots.txt, and JSON-LD. Set NEXT_PUBLIC_SITE_URL in the deployment
 *  environment; localhost keeps previews working. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** The ticketing platform behind the purchase box. Credited there (and only
 *  there) — the one place a visitor is looking at the product. */
export const COW_TICKET_URL = "https://cowticket.app";

/** CowTicket's public page API (no key; open CORS), which the preview page
 *  calls from the browser. A BUILD variable — baked into the page — so set
 *  NEXT_PUBLIC_COWTICKET_PUBLIC_URL where the site is built when prod differs. */
export const COWTICKET_PUBLIC_URL =
  process.env.NEXT_PUBLIC_COWTICKET_PUBLIC_URL ?? "https://khaansampaokit-web.cowticket.app";
