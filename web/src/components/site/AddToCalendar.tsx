import { googleCalendarUrl } from "@/lib/ics";
import { siteUrl } from "@/lib/config";
import type { PublicEvent } from "@/lib/queries/public";
import styles from "./EventCard.module.css";

/** Google Calendar link + .ics download (Apple/Outlook). No JS needed. */
export function AddToCalendar({ ev }: { ev: PublicEvent }) {
  const google = googleCalendarUrl({
    start: new Date(ev.startAt),
    end: new Date(ev.endAt),
    summary: ev.title,
    description: `${ev.summary}\n\n${siteUrl(`/events/${ev.slug}`)}`,
    location: [ev.venue, ev.address].filter(Boolean).join(", "),
  });
  return (
    <details className={styles.cal}>
      <summary className="btn btn--ghost btn--sm">Add to calendar</summary>
      <div className={styles.calMenu}>
        <a href={google} target="_blank" rel="noopener">
          Google Calendar <span className="sr-only">(opens in a new tab)</span>
        </a>
        <a href={`/events/${ev.slug}/calendar.ics`} download={`${ev.slug}.ics`}>
          Apple / Outlook (.ics)
        </a>
      </div>
    </details>
  );
}
