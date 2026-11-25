import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic dynamic rendering model (no Cache Components): booking data is
  // read per-request from Postgres, and marketing pages opt into caching
  // explicitly where it helps.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 828, 1080, 1280, 1600, 2048],
  },
  poweredByHeader: false,
  async headers() {
    const baseSecurity = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), browsing-topics=()" },
      {
        key: "Content-Security-Policy",
        value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com",
      },
    ];
    const privateTokenHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    const adminIframeOverride = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Content-Security-Policy",
        value: "sandbox; default-src 'none'; img-src * data:; style-src 'unsafe-inline' *; font-src *; frame-ancestors 'self'",
      },
    ];
    return [
      { source: "/:path*", headers: baseSecurity },
      {
        source: "/admin/:path*",
        headers: [...privateTokenHeaders, { key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      { source: "/booking/:path*", headers: privateTokenHeaders },
      { source: "/manage/:path*", headers: privateTokenHeaders },
      { source: "/waiver/:path*", headers: privateTokenHeaders },
      { source: "/review/:path*", headers: privateTokenHeaders },
      { source: "/checkout/:path*", headers: privateTokenHeaders },
      { source: "/gift-cards/success", headers: privateTokenHeaders },
      { source: "/api/admin/emails/:id", headers: adminIframeOverride },
      { source: "/api/admin/campaigns/:id/preview", headers: adminIframeOverride },
      {
        source: "/api/dev/emails/:template",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
