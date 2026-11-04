"use client";

import { useId } from "react";
import { fmtTime } from "@/lib/time";
import type { ApiSlot } from "./useAvailability";
import styles from "./booking.module.css";

const REASON: Record<string, string> = {
  booked: "booked",
  blocked: "unavailable",
  calendar: "booked",
  past: "already started",
  notice: "too soon to book",
  too_far: "too far ahead",
};

/** Start times for one day. Taken times are struck through rather than hidden. */
export function SlotPicker({
  slots,
  selected,
  onSelect,
  loading,
  title = "Pick a start time",
  emptyText,
}: {
  slots: ApiSlot[];
  selected: string | null;
  onSelect: (startIso: string) => void;
  loading?: boolean;
  title?: string;
  emptyText?: string;
}) {
  const titleId = useId();
  return (
    <div>
      <h4 id={titleId} className={styles.sideTitle}>
        {title}
      </h4>
      <div className={styles.slots} role="group" aria-labelledby={titleId} aria-busy={loading || undefined}>
        {loading && slots.length === 0 ? (
          Array.from({ length: 6 }, (_, i) => <span key={i} className={styles.slotSkeleton} aria-hidden="true" />)
        ) : slots.length === 0 ? (
          <p className={styles.slotsEmpty}>{emptyText ?? "Pick a day on the calendar to see what's open."}</p>
        ) : (
          slots.map((s) => {
            const label = fmtTime(s.start);
            const end = fmtTime(s.end);
            const why = s.available ? "" : (REASON[s.reason ?? ""] ?? "unavailable");
            return (
              <button
                key={s.start}
                type="button"
                className={styles.slot}
                aria-pressed={selected === s.start}
                disabled={!s.available}
                aria-label={s.available ? `${label} to ${end}` : `${label}, ${why}`}
                title={why || undefined}
                onClick={() => onSelect(s.start)}
              >
                <span>{label}</span>
                <small aria-hidden="true">to {end}</small>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
