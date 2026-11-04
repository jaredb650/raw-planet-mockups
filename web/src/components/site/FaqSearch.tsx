"use client";

import { useId, useState } from "react";
import styles from "./FaqSearch.module.css";

/** Shows/hides the FAQ accordions inside `#<scopeId>` and returns how many match. */
function applyFilter(scopeId: string, raw: string): number | null {
  const scope = document.getElementById(scopeId);
  if (!scope) return null;
  const term = raw.trim().toLowerCase();
  const words = term.split(/\s+/).filter(Boolean);
  let n = 0;
  scope.querySelectorAll<HTMLDetailsElement>("details[data-faq]").forEach((d) => {
    const hit = words.every((w) => (d.dataset.faq ?? "").includes(w));
    d.hidden = !hit;
    if (hit) n++;
    // Open the first few matches so the answer is visible straight away.
    d.open = Boolean(term) && hit && n <= 3;
  });
  scope.querySelectorAll<HTMLElement>("[data-faq-group]").forEach((g) => {
    g.hidden = !g.querySelector("details[data-faq]:not([hidden])");
  });
  return term ? n : null;
}

/** Filters the FAQ as you type. Progressive enhancement: without JS every question is listed. */
export function FaqSearch({ scopeId }: { scopeId: string }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);
  const id = useId();

  return (
    <div className={styles.box} role="search">
      <label htmlFor={id} className="sr-only">
        Search the questions
      </label>
      <input
        id={id}
        type="search"
        className={`input ${styles.input}`}
        placeholder="Search: refund, kids, Spanish, gift…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setShown(applyFilter(scopeId, e.target.value));
        }}
        autoComplete="off"
      />
      <p className={styles.count} aria-live="polite">
        {shown === null ? "" : shown === 0 ? "No questions match that. Try another word, or ask us below." : `${shown} matching question${shown === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
