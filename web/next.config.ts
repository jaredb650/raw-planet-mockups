import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic dynamic rendering model (no Cache Components): booking data is
  // read per-request from Postgres, and marketing pages opt into caching
  // explicitly where it helps.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 828, 1080, 1280, 1600, 2048],
  },
  poweredByHeader: false,
};

export default nextConfig;
