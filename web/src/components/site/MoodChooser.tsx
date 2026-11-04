"use client";

import { MOODS } from "@/content/site";
import { MoodIcon } from "./MoodIcons";
import { useMood } from "./MoodContext";
import styles from "./MoodChooser.module.css";

type Item = { slug: string; theme: string; shortName: string; locationArea: string };

export function MoodChooser({ items }: { items: Item[] }) {
  const { slug, picked, choose } = useMood();
  const current = items.find((i) => i.slug === slug) ?? items[0];
  return (
    <>
      <div className={styles.grid} role="group" aria-label="Choose an experience">
        {items.map((it) => {
          const copy = MOODS[it.theme] ?? { label: it.shortName, blurb: "", picked: `${it.shortName} it is.` };
          return (
            <button
              key={it.slug}
              type="button"
              className={styles.btn}
              data-mood={it.theme}
              aria-pressed={it.slug === slug && picked}
              onClick={() => choose(it.slug)}
            >
              <span className={styles.check} aria-hidden="true">
                <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <MoodIcon theme={it.theme} className={styles.icon} />
              <span className={styles.text}>
                <span className={styles.big}>{copy.label}</span>
                <span className={styles.small}>{copy.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className={styles.result} aria-live="polite">
        {picked && current ? (
          <>
            {(MOODS[current.theme]?.picked ?? `${current.shortName} it is.`) + " "}
            <a href="#book" className="link">Pick a time</a>
            <span aria-hidden="true"> ↓</span> or{" "}
            <a href={`/experiences/${current.slug}`} className="link">see what happens in the session</a>.
          </>
        ) : (
          <span className={styles.hint}>Not sure? Every session is private, beginner-friendly and hosted by Alex.</span>
        )}
      </p>
    </>
  );
}
