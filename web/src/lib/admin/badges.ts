import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export type Badges = {
  inquiries: number;
  reviews: number;
  deliverables: number;
  calendarErrors: number;
  feedErrors: number;
  failedEmails: number;
};

/** Counts for queues that need Alex's attention (nav badges + Today). */
export async function getBadges(): Promise<Badges> {
  const db = await getDb();
  const res = await db.execute(sql`
    select
      (select count(*) from inquiries where status = 'new')::int as inquiries,
      (select count(*) from reviews where status = 'pending')::int as reviews,
      (select count(*) from bookings b join experiences x on x.id = b.experience_id
        where b.status = 'completed' and x.theme = 'production' and b.deliverable_status <> 'delivered')::int as deliverables,
      (select count(*) from booking_events e
        where e.type = 'calendar_error' and e.created_at > now() - interval '30 days'
          and not exists (select 1 from booking_events r where r.booking_id = e.booking_id and r.type = 'calendar_resolved' and r.created_at >= e.created_at))::int as calendar_errors,
      (select count(*) from calendar_feeds where active and last_error is not null)::int as feed_errors,
      (select count(*) from email_log where status = 'failed' and created_at > now() - interval '7 days')::int as failed_emails
  `);
  const r = rows(res)[0] ?? {};
  return {
    inquiries: Number(r.inquiries ?? 0),
    reviews: Number(r.reviews ?? 0),
    deliverables: Number(r.deliverables ?? 0),
    calendarErrors: Number(r.calendar_errors ?? 0),
    feedErrors: Number(r.feed_errors ?? 0),
    failedEmails: Number(r.failed_emails ?? 0),
  };
}

/** db.execute returns an array (postgres-js) or { rows } (PGlite). */
export function rows<T = Record<string, unknown>>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const r = (res as { rows?: T[] })?.rows;
  return Array.isArray(r) ? r : [];
}
