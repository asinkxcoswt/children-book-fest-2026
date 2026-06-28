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
  /** AA-safe text color to place ON the solid fill. */
  on: string;
}

const TOKENS: Record<ColorToken, TokenClasses> = {
  sunshine: { bg: "bg-sunshine", text: "text-sunshine", border: "border-sunshine", on: "text-ink" },
  meadow: { bg: "bg-meadow", text: "text-meadow", border: "border-meadow", on: "text-paper" },
  tomato: { bg: "bg-tomato", text: "text-tomato", border: "border-tomato", on: "text-paper" },
  sky: { bg: "bg-sky", text: "text-sky", border: "border-sky", on: "text-paper" },
  bubblegum: { bg: "bg-bubblegum", text: "text-bubblegum", border: "border-bubblegum", on: "text-paper" },
  tangerine: { bg: "bg-tangerine", text: "text-tangerine", border: "border-tangerine", on: "text-paper" },
  cornflower: { bg: "bg-cornflower", text: "text-cornflower", border: "border-cornflower", on: "text-paper" },
  peach: { bg: "bg-peach", text: "text-peach", border: "border-peach", on: "text-ink" },
};

export function tokenClasses(token: ColorToken): TokenClasses {
  return TOKENS[token];
}
