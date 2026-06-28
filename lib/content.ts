import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Category, FestivalEvent } from "@/types/content";
import categoriesData from "@/content/categories.json";

const categories = categoriesData as Category[];

const EVENTS_DIR = join(process.cwd(), "content", "events");

/** Read every event JSON file once, at module load (server-only). */
const events: FestivalEvent[] = readdirSync(EVENTS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(EVENTS_DIR, file), "utf8")) as FestivalEvent)
  .sort((a, b) => `${a.schedule.date}${a.schedule.start}`.localeCompare(`${b.schedule.date}${b.schedule.start}`));

export function getCategories(): Category[] {
  return categories;
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getEvents(): FestivalEvent[] {
  return events;
}

export function getFeaturedEvents(): FestivalEvent[] {
  return events.filter((e) => e.featured);
}

export function getEvent(slug: string): FestivalEvent | undefined {
  return events.find((e) => e.slug === slug);
}

export function getEventsByCategory(categorySlug: string): FestivalEvent[] {
  return events.filter((e) => e.category === categorySlug);
}

/** Count of events per category slug — handy for category tiles. */
export function getEventCount(categorySlug: string): number {
  return events.filter((e) => e.category === categorySlug).length;
}
