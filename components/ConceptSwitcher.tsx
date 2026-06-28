import Link from "next/link";

const CONCEPTS = [
  { href: "/v1", label: "v1 · Storybook" },
  { href: "/v2", label: "v2 · Crayon Blocks" },
  { href: "/v3", label: "v3 · Friendly Map" },
];

/** Demo-only bar so reviewers can hop between the three design concepts.
 *  Not part of the production microsite. */
export default function ConceptSwitcher({ current }: { current: "/v1" | "/v2" | "/v3" }) {
  return (
    <div className="w-full border-b-2 border-ink/10 bg-paper">
      <nav
        aria-label="Design concepts"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-sm"
      >
        <Link href="/" className="font-display text-base text-ink hover:underline">
          ← concepts
        </Link>
        <span aria-hidden className="text-ink/30">|</span>
        {CONCEPTS.map((c) => {
          const active = c.href === current;
          return (
            <Link
              key={c.href}
              href={c.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1 transition-colors ${
                active ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/5"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
