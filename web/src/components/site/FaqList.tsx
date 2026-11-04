import type { FaqEntry } from "@/content/site";
import styles from "./FaqList.module.css";

/** Accordion built on <details>/<summary>: keyboard-operable and works without JS. */
export function FaqList({ items, tone = "light" }: { items: Pick<FaqEntry, "q" | "a">[]; tone?: "light" | "dark" }) {
  return (
    <div className={styles.list} data-tone={tone}>
      {items.map((f) => (
        <details key={f.q} className={styles.item} data-faq={`${f.q} ${f.a}`.toLowerCase()}>
          <summary className={styles.q}>
            <span>{f.q}</span>
            <span className={styles.icon} aria-hidden="true" />
          </summary>
          <div className={styles.a}>
            <p>{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
