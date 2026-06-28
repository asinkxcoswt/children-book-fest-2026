import Link from "next/link";
import { getCategories, getEventCount } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick } from "@/lib/i18n";

/* Variant 3 — "Friendly Map": the festival as a village; each zone is a place you visit.
 * The map is decorative wayfinding; the list below it is the accessible source of truth. */

/* Pin positions on the map (percent). Order matches getCategories(). */
const PIN_POSITIONS = [
  { left: "12%", top: "22%" },
  { left: "58%", top: "14%" },
  { left: "74%", top: "55%" },
  { left: "30%", top: "64%" },
];

export default function V3Home() {
  const categories = getCategories();

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 py-12">
        <p className="font-display text-lg text-meadow">
          {t("festivalName")} · {t("festivalYear")}
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl leading-tight text-ink">
          {t("tagline")}
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink/75">{t("heroBody")}</p>

        {/* Decorative map. Pins duplicate the list below, so it is aria-hidden. */}
        <div
          aria-hidden
          className="relative mt-8 h-[22rem] overflow-hidden rounded-3xl border-2 border-ink/10 bg-meadow/10"
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(#34984922 1px, transparent 1px), linear-gradient(90deg, #34984922 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {categories.map((cat, i) => {
            const c = tokenClasses(cat.color);
            const pos = PIN_POSITIONS[i % PIN_POSITIONS.length];
            return (
              <div
                key={cat.slug}
                className="absolute -translate-x-1/2 text-center"
                style={{ left: pos.left, top: pos.top }}
              >
                <span
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-paper ${c.bg} font-display text-2xl ${c.on}`}
                >
                  {pick(cat.name).charAt(0)}
                </span>
                <span className="mt-1 block text-xs text-ink/80">{pick(cat.name)}</span>
              </div>
            );
          })}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border-2 border-sunshine bg-paper px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-tomato" />
            {t("youAreHere")}
          </div>
        </div>
        <p className="mt-2 text-xs text-ink/50">{t("festivalMap")}</p>
      </section>

      {/* Accessible zone list — the real navigation. */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="font-display text-3xl text-ink">{t("browseZones")}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {categories.map((cat) => {
            const c = tokenClasses(cat.color);
            return (
              <li key={cat.slug}>
                <Link
                  href={`/v3/category/${cat.slug}`}
                  className="flex items-center gap-4 rounded-2xl border-2 border-ink/10 p-4 transition-colors hover:border-ink/30"
                >
                  <span
                    aria-hidden
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${c.bg} font-display text-2xl ${c.on}`}
                  >
                    {pick(cat.name).charAt(0)}
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-2xl text-ink">{pick(cat.name)}</span>
                    <span className="block text-sm text-ink/70">{pick(cat.description)}</span>
                    <span className="mt-1 block text-sm text-meadow">
                      {getEventCount(cat.slug)} {t("events")} · {t("enterZone")} →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
