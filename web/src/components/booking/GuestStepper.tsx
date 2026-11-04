"use client";

import { useId } from "react";
import styles from "./booking.module.css";

export function GuestStepper({
  value,
  min,
  max,
  onChange,
  label = "How many people?",
  hint,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={styles.guests}>
      <div>
        <h4 id={`${id}-l`} className={styles.sideTitle} style={{ margin: 0 }}>
          {label}
        </h4>
        {hint ? (
          <p id={`${id}-h`} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
      <div className={styles.stepper} role="group" aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label="Remove a guest"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
        <output aria-live="polite" aria-label={`${value} ${value === 1 ? "guest" : "guests"}`} className="tabular">
          {value}
        </output>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="Add a guest"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
