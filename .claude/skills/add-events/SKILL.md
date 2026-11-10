---
name: add-events
description: Create or update festival event JSON from new poster images dropped in image-src/content/events, rename the posters to their slug, optimise images and append new events to the Notion confirmation table. Use when the user says they placed new posters/images for events.
---

# Add / update events from new posters

The user drops poster images in `image-src/content/events/`. Extra source text may come from
`event-details.xlsx`, a pasted message, a .docx passed as an argument, or the poster itself.
Arguments (optional): $ARGUMENTS

## 1. Find the new images

- List `image-src/content/events/`. A file is **new** if its name is not `<slug>.jpeg` for an
  existing `content/events/<slug>.json` (e.g. Thai names, `IMG_…`, `.png`, `.jpg`).
- View each new image. Decide whether it **replaces** an existing event's poster (same title)
  or is a **new** event. If unclear, ask.

## 2. Gather details

Sources, in priority order: what the user pasted / the docx > `event-details.xlsx`
(read with the xlsx skill or `node`; Thai text in Python heredocs breaks, use `node -e` or Write)
> the poster. **Descriptions are copied verbatim** from the organiser's text — never rewrite.
If date, time, price or venue conflict between sources, ask the user.

## 3. Write the JSON

Copy the shape of an existing file in `content/events/` (e.g. `a-day-without-internet.json`):

- `slug`: short English kebab-case of the title.
- `thumbnail` and `gallery[0].src`: `/content/events/<slug>.jpeg`; write a Thai `alt` describing the poster.
- `mascot`: pick one from `/content/mascots/<name>.png` (names in `public/content/mascots/`), vary across events.
- `category`: one of the ids in `content/categories.json`
  (`storytelling`, `workshop`, `meet-the-creators`, `seminar`).
- `schedule`: default `venue` + `sessions[{date, start, end, venue?, ticketCodes:["yyyymmdd-hhmm"]}]`;
  a session `venue` only when it differs from the default. Venues should match names in `content/venue.json`.
- `price` in baht; `admission`: `free` (price 0), `ticket`, or `donation`.
- `ticketEventCode`: `cbf2026-<slug>`.
- `summary`: one short Thai sentence; `presenter`; `ageRange` as written by the organiser.

For a **replaced poster**, only overwrite the image (and update fields the user gave new info for).

## 4. Images

- Rename each new poster to `image-src/content/events/<slug>.jpeg` (`mv`; convert to jpeg with `sips -s format jpeg` if needed).
- Run `npx -y pnpm@11 images` (PATH pnpm is 10.x and won't work).

## 5. Ticket add-ons

Do **not** add entries to `ADD_ON_OVERRIDES_BY_SLUG` in `scripts/sync-tickets.mjs` unless the
user asks (defaults apply), **except** adults-only events (ageRange has no children/families) → always set `NONE` — but only if nothing is sold yet: CowTicket refuses to remove an add-on any order already includes, so an event with sales keeps its add-ons. Free events with no tickets → ask whether to set `NONE`.
Never run the sync for real; the user runs it.

## 6. Notion

For **new** events only, append rows to the "3. จำนวนรับ" table in the Notion page
"รายการข้อมูลกิจกรรมที่ต้องยืนยันกับผู้จัด" (page id `404641af-98ce-81a1-b10c-e7b1816efd9c`):
fetch the page, then add per event a row whose first cell is a link
`https://children-book-fest-2026.kwanjaoei.com/event/<slug>` (link text = event title, as in existing rows)
followed by 4 empty cells. Match the existing rows' format exactly.

## 7. Verify and report

- Run `npx -y pnpm@11 check` (one pre-existing warning about unused `PURCHASE_FORM` is expected).
- Report a table: slug, title, date/time, category, price, new/updated. Flag anything guessed.
- Don't commit unless asked.
