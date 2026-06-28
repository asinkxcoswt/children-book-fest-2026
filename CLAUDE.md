@AGENTS.md

# CLAUDE.md — Children's Picture Book Festival Microsite

> Persistent project context for Claude Code. Read this at the start of every session.
> Keep this file lean. If a line wouldn't change Claude's behavior or prevent a mistake, delete it.

---

- App Router (`app/`), not Pages Router
- TypeScript
- Tailwind CSS for styling
- `pnpm` as package manager
- Bilingual: Thai (default) + English
- Event registration is handled by an **external** system (links out), not built in-house

---

## Project overview

A promotional microsite for the annual **Children's Picture Book Festival** (client: kwanjaoei.com).
The site promotes the festival and lets visitors browse events and register for the ones they want.

Information architecture:
1. **Home** — festival concept/theme, hero, navigation into themed zones
2. **Categories (themed zones)** — e.g. storytelling, illustration workshops, author talks
3. **Event listing** — events shown under each category
4. **Event detail** — title, description, image gallery, schedule/venue, registration CTA
5. **Registration** — per-event; links out to the external registration system

The audience is parents, educators, and children. Tone is warm, playful, and accessible.

---

## Commands

<!-- CONFIRM these match package.json scripts -->
- Dev: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Format: `pnpm format`

Always run `pnpm lint` and `pnpm typecheck` before declaring a task complete, and show me the output.

---

## Project structure & conventions

- Pages/routes live in `app/`. Use the App Router (Server Components by default; add `"use client"` only when interactivity requires it).
- Shared UI in `components/`. One component per file, PascalCase filename matching the export.
- Content/data lives in `content/` (see Content architecture below) — **never** hardcode event data inside components.
- Utilities in `lib/`. Types in `types/`.
- Co-locate component styles; no global CSS except the token layer and base resets.

---

## Design system

### Color tokens — USE THESE ONLY

Never write raw hex values in components. Use the named tokens below (Tailwind classes or CSS variables).
This palette comes from the designer; do not invent new colors without asking.

| Token        | Hex        | Notes                                  |
|--------------|------------|----------------------------------------|
| `sunshine`   | `#fce639`  | bright yellow                          |
| `meadow`     | `#349849`  | green                                  |
| `tomato`     | `#ef432c`  | warm red                               |
| `sky`        | `#009ac9`  | cyan-blue                              |
| `bubblegum`  | `#e53d6b`  | pink / magenta                         |
| `tangerine`  | `#f04b2f`  | orange-red (very close to `tomato`)    |
| `cornflower` | `#3d67af`  | mid blue                               |
| `peach`      | `#f2c29d`  | soft peach / skin tone for illustration|
| `ink`        | `#000000`  | text / outlines                        |
| `paper`      | `#ffffff`  | background                             |

Implementation contract: define these as CSS custom properties in the global token layer
(`app/globals.css`) and reference them from `tailwind.config` so both Tailwind classes and raw
CSS resolve to the same source of truth. Define them once; do not duplicate the hex anywhere else.

### Typography

- Headings + body must support **Thai and Latin** glyphs. Load via `next/font`.
- Suggested: a rounded, friendly Thai-capable family. Do not introduce a font that lacks Thai coverage.
- Set `lang` correctly per locale so Thai renders with proper line-height and word-breaking.

### Visual tone

Playful and child-friendly, but never at the expense of legibility or accessibility.
Generous spacing, large tap targets, high contrast for text.

---

## Internationalization

- Default locale: Thai (`th`). Secondary: English (`en`).
- All user-facing copy comes from locale files — no hardcoded strings in components.
- Set `<html lang>` per active locale. Test Thai line-breaking and font rendering on every page.

---

## Content & data architecture

<!-- DECISION NEEDED — confirm before building listing/detail pages -->
Events and categories are **structured data the client can edit**, not values hardcoded in components.
Source options to decide on: local MDX/JSON in `content/`.

Each **event** record should include at minimum: id/slug, title (th/en), description (th/en),
category, schedule (date/time), venue, image gallery, capacity (if shown), and the external
registration URL. Each **category** has: id/slug, name (th/en), description, and a brand color token.

Until this is finalized, do not scaffold pages that assume a specific shape — ask first.

---

## Registration

Registration is performed on an **external system** (the references link out rather than collect
data in-page). The event detail page should present a clear CTA linking to the correct external
registration URL for that event. Do **not** build forms that collect personal data, payment info,
or credentials in this repo unless I explicitly ask and we've agreed where the data goes.

---

## Coding conventions

- TypeScript strict; no `any` without a comment justifying it.
- Server Components by default; `"use client"` only when needed (state, effects, browser APIs).
- Images via `next/image` with explicit dimensions and `alt` text (galleries are image-heavy —
  unoptimized images will wreck performance).
- Accessibility is required, not optional: semantic HTML, keyboard navigation, visible focus
  states, alt text, and AA contrast. This is a children's/education site and will be scrutinized.
- Prefer composition over large multi-purpose components.

---

## Hard rules

- **Never** commit secrets, `.env*` files, or API keys.
- **Never** use a raw hex color in a component — use a token.
- **Never** hardcode event/category content into components — it must come from the data layer.
- **Never** push directly to `main`. Work on feature branches; commits get reviewed like a human PR.
- Don't add dependencies without telling me what and why first.

---

## When to stop and ask

- The task touches the data model / content architecture and it isn't finalized yet.
- A change would affect more than ~5 files or alter routing/architecture — plan first, then ask.
- A design choice isn't covered by the tokens or the designer's intent is unclear.
- Anything involving registration data, third-party integrations, or deployment config.