import Link from "next/link";
import type { PublicEvent } from "@/lib/queries/public";
import { formatMoney } from "@/lib/money";
import { fmt, fmtTimeRange } from "@/lib/time";
import { AddToCalendar } from "./AddToCalendar";
import styles from "./EventCard.module.css";

export function spotsLabel(ev: PublicEvent): string | null {
  if (ev.spotsLeft == null) return null;
  if (ev.spotsLeft === 0) return "Full — join the waitlist on Meetup";
  if (ev.spotsLeft <= 5) return `Only ${ev.spotsLeft} spot${ev.spotsLeft === 1 ? "" : "s"} left`;
  return `${ev.spotsLeft} spots left`;
}

export function DateBlock({ iso, size = "md" }: { iso: string; size?: "md" | "lg" }) {
  return (
    <div className={styles.date} data-size={size} aria-hidden="true">
      <span className={styles.month}>{fmt(iso, "MMM")}</span>
      <span className={styles.day}>{fmt(iso, "d")}</span>
      <span className={styles.dow}>{fmt(iso, "EEE")}</span>
    </div>
  );
}

export function EventCard({ ev, compact }: { ev: PublicEvent; compact?: boolean }) {
  const spots = spotsLabel(ev);
  const cancelled = ev.status === "cancelled";
  const canRsvp = ev.rsvpEnabled && ev.spotsLeft !== 0;
  return (
    <article className={styles.card} data-compact={compact || undefined} aria-labelledby={`ev-${ev.id}`}>
      <DateBlock iso={ev.startAt} />
      <div className={styles.body}>
        <p className={styles.when}>
          <time dateTime={ev.startAt}>{fmt(ev.startAt, "EEEE, MMMM d")}</time> · {fmtTimeRange(ev.startAt, ev.endAt)}
        </p>
        <h3 id={`ev-${ev.id}`} className={styles.title}>
          <Link href={`/events/${ev.slug}`}>{ev.title}</Link>
        </h3>
        {cancelled ? <p className="notice notice--danger">This event has been cancelled.</p> : null}
        {!compact && ev.summary ? <p className={styles.summary}>{ev.summary}</p> : null}
        <ul className={styles.meta}>
          {ev.venue ? <li>{ev.venue}</li> : null}
          <li>{ev.priceCents ? formatMoney(ev.priceCents) : "Free"}</li>
          {spots && !cancelled ? <li data-low={ev.spotsLeft != null && ev.spotsLeft <= 5 ? "" : undefined}>{spots}</li> : null}
        </ul>
        {!cancelled ? (
          <div className={styles.actions}>
            {canRsvp ? (
              <Link href={`/events/${ev.slug}#rsvp`} className="btn btn--accent btn--sm">
                RSVP<span className="sr-only"> to {ev.title}</span>
              </Link>
            ) : null}
            {ev.meetupUrl ? (
              <a href={ev.meetupUrl} className={`btn btn--sm ${canRsvp ? "btn--ghost" : "btn--accent"}`} target="_blank" rel="noopener">
                {canRsvp ? "On Meetup" : "RSVP on Meetup"} <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : null}
            {!compact ? <AddToCalendar ev={ev} /> : null}
            {compact && !canRsvp && !ev.meetupUrl ? (
              <Link href={`/events/${ev.slug}`} className="btn btn--ghost btn--sm">
                Details
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
