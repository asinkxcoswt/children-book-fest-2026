/** Decorative wavy bottom edge for hero bands — a soft page-turn curve instead
 *  of a hard rectangle cut. `fill` is a CSS color value (use the token vars,
 *  e.g. "var(--color-peach)"). */
export default function WaveEdge({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 40"
      preserveAspectRatio="none"
      className="block h-8 w-full sm:h-10"
    >
      <path
        d="M0,0 L1440,0 L1440,14 C1200,38 984,2 720,16 C468,29 216,6 0,24 Z"
        style={{ fill, opacity }}
      />
    </svg>
  );
}
