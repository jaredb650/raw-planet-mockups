"use client";

import Link from "next/link";
import { useEffect } from "react";
import a from "@/components/admin/admin.module.css";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-error]", error);
  }, [error]);

  return (
    <div className={`${a.page} ${a.pageNarrow}`} style={{ paddingTop: 48 }}>
      <div className={a.panel}>
        <div className={a.panelBody}>
          <h1 style={{ marginTop: 0, fontSize: 22 }}>Something went wrong</h1>
          <p className={a.muted}>
            We hit an unexpected error loading this admin view. Try reloading it, or head back to Today.
          </p>
          <div className={a.row} style={{ marginTop: 16, gap: 10 }}>
            <button type="button" onClick={() => reset()} className={`${a.btn} ${a.btnPrimary}`}>
              Try again
            </button>
            <Link href="/admin" className={a.btn}>
              Back to Today
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
