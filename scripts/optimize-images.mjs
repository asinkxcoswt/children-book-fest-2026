#!/usr/bin/env node
/* Pre-renders every image under image-src/content into public/content, since
 * the static export has no image server. For each source it writes:
 *   name-400.webp, name-800.webp, name-1600.webp  — what lib/imageLoader.ts
 *                                                    serves to next/image
 *   name-og.jpg                                    — the share-card version
 * Widths never upscale; a 1000px source gets a 1000px "-1600" file. Sources
 * stay out of public/ so the multi-megabyte originals never ship.
 *
 * Run: pnpm images   (sharp comes with Next, no extra dependency)
 *
 * Two files are hand-cut from the client's banner (image-src/content/banner.png,
 * 3090x1356) and should be re-cut if a new banner arrives:
 *   image-src/content/banner-mobile.png  extract {left:0, top:0, width:1040, height:1356}
 *                                        (the character cluster, no lettering)
 *   public/og/festival-share.png         resize {height:630}, then
 *                                        extract {left:118, top:0, width:1200, height:630}
 */
import { readdir, mkdir, stat } from "node:fs/promises";
import { join, dirname, extname, relative } from "node:path";
import sharp from "sharp";

const SRC = "image-src/content";
const OUT = "public/content";
const WIDTHS = [400, 800, 1600]; // keep in sync with lib/imageLoader.ts
const OG_WIDTH = 1200;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(png|jpe?g)$/i.test(entry.name)) yield p;
  }
}

async function fresh(src, out) {
  try {
    const [s, o] = await Promise.all([stat(src), stat(out)]);
    return o.mtimeMs >= s.mtimeMs;
  } catch {
    return false;
  }
}

let written = 0;
for await (const src of walk(SRC)) {
  const rel = relative(SRC, src);
  const base = join(OUT, rel.replace(extname(rel), ""));
  await mkdir(dirname(base), { recursive: true });
  const jobs = [
    ...WIDTHS.map((w) => ({
      out: `${base}-${w}.webp`,
      run: () => sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }),
    })),
    {
      out: `${base}-og.jpg`,
      run: () =>
        sharp(src)
          .flatten({ background: "#ffffff" })
          .resize({ width: OG_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true }),
    },
  ];
  for (const job of jobs) {
    if (await fresh(src, job.out)) continue;
    await job.run().toFile(job.out);
    written += 1;
  }
}
console.log(`optimize-images: ${written} file(s) written to ${OUT}`);
