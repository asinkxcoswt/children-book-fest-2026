import Link from "next/link";
import Image from "next/image";
import { getCategories } from "@/lib/content";
import { tokenClasses } from "@/lib/colors";
import { t, pick } from "@/lib/i18n";

/* Variant 3 "Friendly Map" — reusable festival map.
 * Pins link to their zone. When `currentSlug` is set (a category page), the
 * "you are here" marker sits on that zone and the trail starts from it. */

/* Pin positions on the map (percent). Order matches getCategories(). */
const PIN_POSITIONS = [
  { left: "12%", top: "22%" },
  { left: "58%", top: "14%" },
  { left: "74%", top: "55%" },
  { left: "30%", top: "64%" },
];

/* The trail SVG draws into this viewBox, stretched to fill (preserveAspectRatio="none"). */
const TRAIL_VIEWBOX = { w: 1024, h: 352 };
/* Home start point: the "you are here" corner badge. */
const HOME_START = { left: "84%", top: "86%" };
/* Visiting order (indices into PIN_POSITIONS) chosen to weave across without crossing. */
const TRAIL_ORDER = [2, 1, 0, 3];

const pct = (value: string, total: number) => (parseFloat(value) / 100) * total;

/* Smooth a list of percent points into a Catmull-Rom spline of cubic Béziers. */
function buildTrail(points: { left: string; top: string }[]): string {
  const pts = points.map((p) => ({ x: pct(p.left, TRAIL_VIEWBOX.w), y: pct(p.top, TRAIL_VIEWBOX.h) }));
  return pts.reduce((d, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const p0 = pts[i - 2] ?? pts[i - 1];
    const p1 = pts[i - 1];
    const p3 = pts[i + 1] ?? p;
    const c1x = p1.x + (p.x - p0.x) / 6;
    const c1y = p1.y + (p.y - p0.y) / 6;
    const c2x = p.x - (p3.x - p1.x) / 6;
    const c2y = p.y - (p3.y - p1.y) / 6;
    return `${d} C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, "");
}

export default function FestivalMap({ currentSlug }: { currentSlug?: string }) {
  const categories = getCategories();
  const currentIndex = categories.findIndex((c) => c.slug === currentSlug);

  // Trail starts at the current zone (category page) or the corner badge (home),
  // then visits the remaining zones in the weaving order.
  const start = currentIndex >= 0 ? PIN_POSITIONS[currentIndex] : HOME_START;
  const visitOrder = TRAIL_ORDER.filter((i) => categories[i].slug !== currentSlug);
  const trailD = buildTrail([start, ...visitOrder.map((i) => PIN_POSITIONS[i])]);

  return (
    <>
      <div className="relative mt-8 h-[22rem] overflow-hidden rounded-3xl border-2 border-ink/10 bg-meadow/10">
        {/* Decorative grid + trail. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(#34984922 1px, transparent 1px), linear-gradient(90deg, #34984922 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <svg
          aria-hidden
          viewBox={`0 0 ${TRAIL_VIEWBOX.w} ${TRAIL_VIEWBOX.h}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full text-tomato"
        >
          <defs>
            <marker
              id="v3-trail-arrow"
              markerWidth="20"
              markerHeight="20"
              refX="14"
              refY="10"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M2 2 L18 10 L2 18 Z" fill="currentColor" />
            </marker>
          </defs>
          <path
            d={trailD}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 11"
            markerEnd="url(#v3-trail-arrow)"
            style={{ vectorEffect: "non-scaling-stroke" }}
          />
        </svg>

        {categories.map((cat, i) => {
          const c = tokenClasses(cat.color);
          const pos = PIN_POSITIONS[i % PIN_POSITIONS.length];
          // Flip the popup below top-row pins so it isn't clipped by the rounded overflow.
          const below = parseFloat(pos.top) < 40;
          const isCurrent = cat.slug === currentSlug;
          const badge = (
            <>
              <span
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-4 ${
                  isCurrent ? "border-tomato" : "border-paper"
                } ${c.bg} font-display text-2xl ${c.on}`}
              >
                {pick(cat.thumbnailLetter)}
              </span>
              <span className="mt-1 block text-xs text-ink/80">{pick(cat.name)}</span>
            </>
          );
          return (
            <div
              key={cat.slug}
              className="group absolute -translate-x-1/2 text-center"
              style={{ left: pos.left, top: pos.top }}
            >
              {/* Thumbnail popup on hover. */}
              <div
                className={`pointer-events-none absolute left-1/2 z-10 w-[132px] -translate-x-1/2 scale-90 overflow-hidden rounded-xl border-4 border-paper opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 ${
                  below ? "top-full mt-2" : "bottom-full mb-2"
                }`}
              >
                <Image
                  src={cat.thumbnail}
                  alt=""
                  width={132}
                  height={99}
                  className="block h-auto w-full object-cover"
                />
              </div>

              {isCurrent ? (
                <div aria-current="page">{badge}</div>
              ) : (
                <Link
                  href={`/v3/category/${cat.slug}`}
                  className="block rounded-2xl outline-offset-4 transition-transform hover:-translate-y-0.5"
                >
                  {badge}
                </Link>
              )}

              {isCurrent && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border-2 border-sunshine bg-paper px-2 py-0.5 text-[11px] text-ink">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-tomato" />
                  {t("youAreHere")}
                </span>
              )}
            </div>
          );
        })}

        {/* Corner "you are here" only on the home map (no current zone). */}
        {currentIndex < 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border-2 border-sunshine bg-paper px-3 py-1 text-xs">
            <span aria-hidden className="h-2 w-2 rounded-full bg-tomato" />
            {t("youAreHere")}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-ink/50">{t("festivalMap")}</p>
    </>
  );
}
