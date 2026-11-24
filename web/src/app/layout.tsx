import type { Metadata, Viewport } from "next";
import { Big_Shoulders, DM_Sans, Unbounded } from "next/font/google";
import { BUSINESS, siteUrl } from "@/lib/config";
import "./globals.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display", display: "swap" });
// Wide rounded geometric caps, the closest free match to the logo's "RAW" lettering (future style).
const future = Unbounded({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-future", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${BUSINESS.name} · Music experiences in New York City`, template: `%s · ${BUSINESS.name}` },
  description:
    "Music production, DJ and meditation experiences in New York City with producer Alex Gentil. No experience needed. Rated 4.98 from 107 Airbnb reviews.",
  openGraph: { type: "website", siteName: BUSINESS.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  // Prototype / staging deploys set SITE_NOINDEX=1 so they never compete with the real site in search.
  ...(process.env.SITE_NOINDEX === "1" ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = { themeColor: "#1f1c24", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-look="bold": the colour-band skin. data-style="future": the logo-matched type and shapes on top of it.
    // Remove an attribute to go back a step (globals.css).
    <html lang="en" className={`${display.variable} ${future.variable} ${body.variable}`} data-look="bold" data-style="future">
      <body>{children}</body>
    </html>
  );
}
