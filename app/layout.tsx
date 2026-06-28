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
  title: `${t("festivalName")} ${t("festivalYear")}`,
  description: t("heroBody"),
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
