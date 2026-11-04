import Link from "next/link";
import { asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eventRsvps, events } from "@/lib/db/schema";
import { fmt, fmtTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Events" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const past = one((await searchParams).show) === "past";
  const db = await getDb();
  const now = new Date();
  const going = db
    .select({ eventId: eventRsvps.eventId, people: sql<number>`coalesce(sum(${eventRsvps.guests}),0)::int`.as("people") })
    .from(eventRsvps)
    .where(eq(eventRsvps.status, "going"))
    .groupBy(eventRsvps.eventId)
    .as("g");
  const rows = await db
    .select({ e: events, people: going.people })
    .from(events)
    .leftJoin(going, eq(going.eventId, events.id))
    .where(past ? lt(events.endAt, now) : gte(events.endAt, now))
    .orderBy(past ? desc(events.startAt) : asc(events.startAt))
    .limit(100);
  const series = new Set(rows.filter((r) => r.e.seriesId).map((r) => r.e.seriesId));

  return (
    <div className={a.page}>
      <PageHeader
        title="Events"
        sub="Community meetups and workshops. Biweekly series repeat automatically; link each one to Meetup."
        actions={
          <Link href="/admin/events/new" className={`${a.btn} ${a.btnPrimary}`}>
            <Icon name="plus" size={16} /> New event
          </Link>
        }
      />
      <nav className={a.tabs} aria-label="Events">
        <Link href="/admin/events" className={`${a.tab} ${!past ? a.tabActive : ""}`} aria-current={!past ? "page" : undefined}>
          Upcoming
        </Link>
        <Link href="/admin/events?show=past" className={`${a.tab} ${past ? a.tabActive : ""}`} aria-current={past ? "page" : undefined}>
          Past
        </Link>
      </nav>
      <Panel>
        {rows.length === 0 ? (
          <Empty>{past ? "No past events." : "Nothing scheduled. Create a biweekly meetup and it fills the calendar for you."}</Empty>
        ) : (
          <div className={a.tableWrap}>
            <table className={`${a.table} ${a.tableStack}`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th className={a.num}>Going</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, people }) => (
                  <tr key={e.id}>
                    <td className={a.nowrap}>
                      <Link href={`/admin/events/${e.id}`} className={a.rowLink}>
                        {fmt(e.startAt, "EEE MMM d")}
                      </Link>
                      <span className={a.cellSub}>{fmtTimeRange(e.startAt, e.endAt)}</span>
                    </td>
                    <td>
                      <Link href={`/admin/events/${e.id}`} className={a.rowLink}>
                        {e.title}
                      </Link>
                      <span className={a.cellSub}>
                        {e.venue || "Venue not set"}
                        {e.seriesId && series.has(e.seriesId) ? " · repeating" : ""}
                        {e.priceCents ? ` · ${formatMoney(e.priceCents)}` : " · free"}
                        {e.meetupUrl ? " · on Meetup" : ""}
                      </span>
                    </td>
                    <td className={a.num} data-label="Going">
                      {Number(people ?? 0)}
                      {e.capacity ? <span className={a.muted}> / {e.capacity}</span> : ""}
                    </td>
                    <td>
                      {e.status === "published" ? <Pill tone="success">On website</Pill> : e.status === "draft" ? <Pill tone="neutral">Draft</Pill> : <Pill tone="danger">Cancelled</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
