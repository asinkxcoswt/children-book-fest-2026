import type { ColorToken } from "@/types/content";

/** Per-token class sets. Written as literal strings so the Tailwind v4 scanner
 *  detects them — never build these class names dynamically. */
interface TokenClasses {
  /** Solid background fill. */
  bg: string;
  /** Foreground text/icon color matching the token. */
  text: string;
  /** Border color. */
  border: string;
  /** Left-edge-only border color, for the ticket-stub spine. Drawn as a border
   *  rather than an inner element so the colour reaches the card's edge and
   *  follows its corner radius. */
  edge: string;
  /** AA-safe text color to place ON the solid fill. */
  on: string;
  /** Soft 10% tint of the token, for selected/backdrop surfaces. */
  soft: string;
  /** Hard riso-style offset shadow in the token color (with pressed-in hover). */
  stamp: string;
}

const TOKENS: Record<ColorToken, TokenClasses> = {
  sunshine: { bg: "bg-sunshine", text: "text-sunshine", border: "border-sunshine", edge: "border-l-sunshine", on: "text-ink", soft: "bg-sunshine/10", stamp: "shadow-[3px_3px_0_var(--color-sunshine)] hover:shadow-[1px_1px_0_var(--color-sunshine)]" },
  meadow: { bg: "bg-meadow", text: "text-meadow", border: "border-meadow", edge: "border-l-meadow", on: "text-paper", soft: "bg-meadow/10", stamp: "shadow-[3px_3px_0_var(--color-meadow)] hover:shadow-[1px_1px_0_var(--color-meadow)]" },
  tomato: { bg: "bg-tomato", text: "text-tomato", border: "border-tomato", edge: "border-l-tomato", on: "text-paper", soft: "bg-tomato/10", stamp: "shadow-[3px_3px_0_var(--color-tomato)] hover:shadow-[1px_1px_0_var(--color-tomato)]" },
  sky: { bg: "bg-sky", text: "text-sky", border: "border-sky", edge: "border-l-sky", on: "text-paper", soft: "bg-sky/10", stamp: "shadow-[3px_3px_0_var(--color-sky)] hover:shadow-[1px_1px_0_var(--color-sky)]" },
  bubblegum: { bg: "bg-bubblegum", text: "text-bubblegum", border: "border-bubblegum", edge: "border-l-bubblegum", on: "text-paper", soft: "bg-bubblegum/10", stamp: "shadow-[3px_3px_0_var(--color-bubblegum)] hover:shadow-[1px_1px_0_var(--color-bubblegum)]" },
  tangerine: { bg: "bg-tangerine", text: "text-tangerine", border: "border-tangerine", edge: "border-l-tangerine", on: "text-paper", soft: "bg-tangerine/10", stamp: "shadow-[3px_3px_0_var(--color-tangerine)] hover:shadow-[1px_1px_0_var(--color-tangerine)]" },
  cornflower: { bg: "bg-cornflower", text: "text-cornflower", border: "border-cornflower", edge: "border-l-cornflower", on: "text-paper", soft: "bg-cornflower/10", stamp: "shadow-[3px_3px_0_var(--color-cornflower)] hover:shadow-[1px_1px_0_var(--color-cornflower)]" },
  peach: { bg: "bg-peach", text: "text-peach", border: "border-peach", edge: "border-l-peach", on: "text-ink", soft: "bg-peach/10", stamp: "shadow-[3px_3px_0_var(--color-peach)] hover:shadow-[1px_1px_0_var(--color-peach)]" },
};

export function tokenClasses(token: ColorToken): TokenClasses {
  return TOKENS[token];
}

/** Read a palette token as a raw value, for the places a CSS class can't reach —
 *  canvas drawing, QR generation. Browser-only: it reads the computed styles of
 *  the document element, so never call it during render on the server. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
