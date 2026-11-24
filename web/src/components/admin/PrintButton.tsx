"use client";

import a from "./admin.module.css";

export function PrintButton() {
  return (
    <button type="button" className={`${a.btn} ${a.btnPrimary}`} onClick={() => window.print()}>
      Print
    </button>
  );
}
