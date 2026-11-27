"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#faf7f2",
          color: "#1e1a17",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <p style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6e6257", margin: "0 0 8px" }}>
            Raw Planet Experiences
          </p>
          <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: "0 0 12px" }}>Something went sideways.</h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "#524840", margin: "0 0 24px" }}>
            We hit an unexpected error loading this page. Try again, or head back to the home page.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                border: "none",
                background: "#1e1a17",
                color: "#faf7f2",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* Intentional full reload so a broken root router state resets cleanly */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid #d7cfc5",
                color: "#1e1a17",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
