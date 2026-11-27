"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[site-error]", error);
  }, [error]);

  return (
    <section className="wrap" style={{ paddingBlock: "96px", maxWidth: 640 }}>
      <p className="eyebrow">Something went wrong</p>
      <h1 style={{ marginTop: 8 }}>We couldn&rsquo;t load this page right now.</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        Please try again in a moment. If you were in the middle of a booking, nothing was charged twice — check your email or reach out on our contact page.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <button type="button" onClick={() => reset()} className="btn">
          Try again
        </button>
        <Link href="/experiences" className="btn btn--ghost">
          Browse experiences
        </Link>
        <Link href="/contact" className="btn btn--ghost">
          Contact Alex
        </Link>
      </div>
    </section>
  );
}
