/* next/image loader for the static export. There is no image server, so
 * every /content/ image is pre-rendered by scripts/optimize-images.mjs into
 * WebP at these widths; this maps the width next/image asks for onto the
 * nearest file that exists. Anything outside /content/ (icons, the OG card)
 * is served as-is. */

export const CONTENT_WIDTHS = [400, 800, 1600] as const;

export default function contentImageLoader({ src, width }: { src: string; width: number }): string {
  if (!src.startsWith("/content/")) return src;
  const w = CONTENT_WIDTHS.find((x) => x >= width) ?? CONTENT_WIDTHS[CONTENT_WIDTHS.length - 1];
  return src.replace(/\.(png|jpe?g)$/i, `-${w}.webp`);
}

/** The share-card version of a content image: a JPEG, because WebP support in
 *  link previews (LINE, Facebook, Messenger) is still uneven. */
export function ogImage(src: string): string {
  if (!src.startsWith("/content/")) return src;
  return src.replace(/\.(png|jpe?g)$/i, "-og.jpg");
}
