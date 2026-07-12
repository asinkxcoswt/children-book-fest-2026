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
  /** Soft 10% tint of the token, for selected/backdrop surfaces. */
  soft: string;
}

const TOKENS: Record<ColorToken, TokenClasses> = {
  sunshine: { bg: "bg-sunshine", text: "text-sunshine", border: "border-sunshine", on: "text-ink", soft: "bg-sunshine/10" },
  meadow: { bg: "bg-meadow", text: "text-meadow", border: "border-meadow", on: "text-paper", soft: "bg-meadow/10" },
  tomato: { bg: "bg-tomato", text: "text-tomato", border: "border-tomato", on: "text-paper", soft: "bg-tomato/10" },
  sky: { bg: "bg-sky", text: "text-sky", border: "border-sky", on: "text-paper", soft: "bg-sky/10" },
  bubblegum: { bg: "bg-bubblegum", text: "text-bubblegum", border: "border-bubblegum", on: "text-paper", soft: "bg-bubblegum/10" },
  tangerine: { bg: "bg-tangerine", text: "text-tangerine", border: "border-tangerine", on: "text-paper", soft: "bg-tangerine/10" },
  cornflower: { bg: "bg-cornflower", text: "text-cornflower", border: "border-cornflower", on: "text-paper", soft: "bg-cornflower/10" },
  peach: { bg: "bg-peach", text: "text-peach", border: "border-peach", on: "text-ink", soft: "bg-peach/10" },
};

export function tokenClasses(token: ColorToken): TokenClasses {
  return TOKENS[token];
}
