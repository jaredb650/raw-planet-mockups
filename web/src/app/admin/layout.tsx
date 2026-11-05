import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Raw Planet admin" },
  robots: { index: false, follow: false },
  // Static file, not under /admin/: browsers fetch manifests without cookies, so the login redirect would break it.
  manifest: "/admin.webmanifest",
  icons: { icon: "/icon.svg", apple: "/admin-icon-180.png" },
  appleWebApp: { capable: true, title: "RP Admin", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#fffaf1" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
