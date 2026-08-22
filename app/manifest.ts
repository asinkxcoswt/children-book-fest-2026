import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${t("festivalName")} ${t("festivalYear")}`,
    short_name: t("festivalName"),
    description: t("heroBody"),
    start_url: "/",
    display: "standalone",
    // Manifests can't reference CSS custom properties — these are the
    // `paper` and `sunshine` design tokens from app/globals.css.
    background_color: "#ffffff",
    theme_color: "#fce639",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
