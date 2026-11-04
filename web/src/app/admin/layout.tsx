import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Raw Planet admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fffaf1" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
