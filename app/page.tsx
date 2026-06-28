import Link from "next/link";
import { t } from "@/lib/i18n";

const CONCEPTS = [
  {
    href: "/v1",
    name: "Storybook Pages",
    note: "Editorial, illustrative, gift-like. Soft washes and a serif voice.",
    swatch: "bg-peach",
    text: "v1",
  },
  {
    href: "/v2",
    name: "Crayon Blocks",
    note: "Bold flat color panels with thick ink outlines. Loud and scannable.",
    swatch: "bg-bubblegum",
    text: "v2",
  },
  {
    href: "/v3",
    name: "Friendly Map",
    note: "A festival village you explore — zones as places on a map.",
    swatch: "bg-meadow",
    text: "v3",
  },
];

export default function ConceptIndex() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="font-display text-lg text-tomato">{`${t("festivalName")} ${t("festivalYear")}`}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-ink">
        Design concepts
      </h1>
      <p className="mt-3 max-w-xl text-ink/70">
        Three directions for the microsite, all driven by the same content layer. Open each to
        browse the home page, a themed zone, and an event detail.
      </p>

      <ul className="mt-10 space-y-4">
        {CONCEPTS.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="flex items-center gap-4 rounded-2xl border-2 border-ink/10 p-5 transition-colors hover:border-ink/30"
            >
              <span aria-hidden className={`h-12 w-12 shrink-0 rounded-xl ${c.swatch} flex items-center justify-center font-bold`} >{c.text}</span>
              <span className="flex-1">
                <span className="font-display text-2xl text-ink">{c.name}</span>
                <span className="block text-sm text-ink/70">{c.note}</span>
              </span>
              <span aria-hidden className="text-2xl text-ink/40">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
