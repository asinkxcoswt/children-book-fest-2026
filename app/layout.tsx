import type { Metadata } from "next";
import { Itim, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { t } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import SiteFooter from "@/components/SiteFooter";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${t("festivalName")} ${t("festivalYear")}`,
    // Suffix without the year — subpage titles get truncated around 60
    // characters in search results, and the page-specific part must survive.
    template: `%s — ${t("festivalName")}`,
  },
  description: t("heroBody"),
  openGraph: {
    siteName: `${t("festivalName")} ${t("festivalYear")}`,
    locale: "th_TH",
    type: "website",
    url: "/",
    images: [
      {
        url: "/og/festival-share.png",
        width: 1200,
        height: 630,
        alt: `${t("festivalName")} ${t("festivalYear")} — ${t("tagline")}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/festival-share.png"],
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
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
