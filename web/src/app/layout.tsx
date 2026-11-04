import type { Metadata, Viewport } from "next";
import { Big_Shoulders, DM_Sans } from "next/font/google";
import { BUSINESS, siteUrl } from "@/lib/config";
import "./globals.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${BUSINESS.name} — Make music in New York`, template: `%s · ${BUSINESS.name}` },
  description:
    "Private music production, DJ and sound meditation sessions in New York City with producer Alex Gentil. No experience needed. Rated 4.98 from 107 Airbnb reviews.",
  openGraph: { type: "website", siteName: BUSINESS.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  // Prototype / staging deploys set SITE_NOINDEX=1 so they never compete with the real site in search.
  ...(process.env.SITE_NOINDEX === "1" ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = { themeColor: "#b8482e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
