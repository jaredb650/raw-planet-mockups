"use client";

import { useEffect, useState } from "react";
import styles from "./StickyBookBar.module.css";

/**
 * Phone-only bottom bar with the price and a "Check dates" jump. Hides itself
 * while the booking section is on screen so it never covers the widget.
 */
export function StickyBookBar({ price, unit, targetId = "book" }: { price: string; unit: string; targetId?: string }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const els = [document.getElementById(targetId)].filter((e): e is HTMLElement => Boolean(e));
    // No booking section (or no IntersectionObserver): the bar has nothing to point at, so it stays hidden.
    if (!els.length || !("IntersectionObserver" in window)) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) visible.add(en.target);
          else visible.delete(en.target);
        }
        setHidden(visible.size > 0);
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [targetId]);

  return (
    <div className={styles.bar} data-hidden={hidden || undefined} aria-hidden={hidden || undefined}>
      <p className={styles.price}>
        <strong>{price}</strong>
        <span>{unit}</span>
      </p>
      <a href={`#${targetId}`} className="btn btn--accent" tabIndex={hidden ? -1 : undefined}>
        Check dates
      </a>
    </div>
  );
}
