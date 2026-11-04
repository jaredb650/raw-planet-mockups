import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or per-guest pages: admin, APIs, checkout, booking/manage/review links.
        disallow: ["/admin", "/api/", "/checkout", "/booking/", "/manage", "/review/"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
