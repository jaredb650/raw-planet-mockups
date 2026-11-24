import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_NOINDEX === "1") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or per-guest pages: admin, APIs, checkout, booking/manage/review/waiver links.
        disallow: ["/admin", "/api/", "/checkout", "/booking/", "/manage", "/review/", "/waiver/", "/unsubscribe"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
