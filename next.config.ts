import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static: `next build` writes out/, served by Cloudflare Pages with
  // the ticket proxies in functions/ next to it. Nothing runs on a Node server.
  output: "export",
  images: {
    // No image server in a static export: /content/ images are pre-rendered
    // by scripts/optimize-images.mjs and the loader picks the right file.
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
  },
};

export default nextConfig;
