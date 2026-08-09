import type { Metadata } from "next";
import { Itim, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { t } from "@/lib/i18n";

/* Display face — rounded, friendly, full Thai + Latin coverage. */
const itim = Itim({
  variable: "--font-itim",
  subsets: ["thai", "latin"],
  weight: "400",
  display: "swap",
});

/* Body face — clean Thai + Latin with multiple weights. */
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for og:image/canonical URLs — set NEXT_PUBLIC_SITE_URL in
  // the deployment environment; localhost keeps previews working.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: `${t("festivalName")} ${t("festivalYear")}`,
  description: t("heroBody"),
  openGraph: {
    siteName: `${t("festivalName")} ${t("festivalYear")}`,
    locale: "th_TH",
    type: "website",
    // Placeholder until a dedicated share poster exists (opengraph-image pass).
    images: [{ url: "/content/storytelling.png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/content/storytelling.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Default locale is Thai; lang drives Thai line-breaking and font rendering.
  return (
    <html lang="th" className={`${itim.variable} ${plexThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
