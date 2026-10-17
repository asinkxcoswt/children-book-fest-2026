# Children's Picture Book Festival 2026 — microsite

Promotional site for the festival: themed zones, event listings, event detail
pages and in-page ticket purchase. Built with Next.js 16 (App Router), exported
as a fully static site and hosted on Cloudflare Pages. Ticketing is handled by
CowTicket; the only server-side code is three small Pages Functions that keep
the CowTicket API key off the browser.

```
app/            routes (static, prerendered at build)
components/     UI
content/        events, categories and UI strings — the editable data
image-src/      image originals (never shipped)
public/content/ pre-rendered WebP/JPEG images (generated, committed)
functions/api/  Cloudflare Pages Functions: the CowTicket proxies
lib/            shared code; lib/ticketApi.ts is the CowTicket client
scripts/        image rendering and ticket sync
docs/           design notes
```

## Prerequisites

- Node 22 and pnpm 11 (`npx -y pnpm@11 …` if your global pnpm is older).
- A `.env.local` copied from `.env.example` with the CowTicket credentials.
  It is read by `pnpm preview` and `pnpm sync:tickets` only; nothing in it
  reaches the static bundle except `NEXT_PUBLIC_SITE_URL`.

```bash
pnpm install
```

## Life cycle

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server on http://localhost:3000. The purchase panel needs the functions, so it will show "unavailable" here — use `pnpm preview` to test buying. |
| `pnpm images` | Renders `image-src/content/**` into `public/content/**` (WebP at 400/800/1600 px plus a JPEG share card). Run after adding or replacing an image, then commit the output. |
| `pnpm build` | Static export into `out/`. Also runs the TypeScript check. |
| `pnpm preview` | Serves `out/` plus `functions/` locally with Cloudflare's runtime on http://localhost:8788, credentials from `.env.local`. This is the real purchase flow against whatever `TICKET_API_URL` points at. Run `pnpm build` first. |
| `pnpm deploy` | Publishes `out/` and `functions/` to the Cloudflare Pages project named in `wrangler.jsonc`. Needs `wrangler login` once. Run `pnpm build` first. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm check` | Lint and typecheck together; run before opening a PR. |
| `pnpm sync:tickets` | Pushes event content into CowTicket's management API (`--dry-run` to preview). Needs an admin key; see the header of `scripts/sync-tickets.mjs`. |

A normal change: edit → `pnpm check` → `pnpm build` → `pnpm preview` to try it
→ commit → PR. Image changes add `pnpm images` before the build.

## Editing content

Events live in `content/events/*.json`, categories in `content/categories.json`,
UI copy in `content/ui.json`. Image paths in those files point at the
*original* name (`/content/events/x/x.png`); the image loader rewrites them to
the rendered WebP at build time, so keep the originals in `image-src/` and run
`pnpm images`.

## How ticketing works

1. The event page calls `GET /api/tickets?eventCode=…` for live availability.
2. The buyer assembles tickets in the browser, which posts to `POST /api/orders`
   (card) or `POST /api/orders/intent` (LINE chat).
3. The function adds the CowTicket credentials, forwards the call, and returns
   where to send the buyer. Card buyers go to Stripe Checkout and then to
   CowTicket's hosted ticket page; chat buyers continue in LINE.

There is no success page, no polling and no ticket rendering on this site —
CowTicket hosts the ticket page. See `cow-ticket.llm.txt` for the platform
contract and `docs/storefront-api-design.md` for the hosting design.

## Deploying to Cloudflare Pages

First time, in the Cloudflare dashboard (or with `wrangler pages project create`):

| Setting | Value |
|---|---|
| Build command (if building on Cloudflare) | `pnpm build` |
| Build output directory | `out` |
| Variables | `TICKET_API_URL`, `TICKET_ACCOUNT_ID`, `NEXT_PUBLIC_SITE_URL` |
| Secrets | `TICKET_API_KEY` |

Then either connect the GitHub repo so every push to `main` deploys, or deploy
from a machine with `pnpm build && pnpm deploy`.

After the first deploy add one WAF rate-limiting rule (free plan allows one):
path starts with `/api/orders`, 10 requests per 10 seconds per IP, block for
10 minutes. It stops anyone holding inventory with a flood of unpaid orders.

## Conventions

See `CLAUDE.md`: design tokens only (no raw hex), content from `content/`
never hardcoded, Thai default with English secondary, accessibility required,
feature branches and PRs, never commit `.env*`.
