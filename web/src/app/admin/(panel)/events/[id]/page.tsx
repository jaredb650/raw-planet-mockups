import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eventRsvps, events } from "@/lib/db/schema";
import { fmt, fmtTimeRange } from "@/lib/time";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ActionForm";
import { EventForm } from "@/components/admin/EventForm";
import { Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import { plural } from "@/components/admin/format";
import { addRsvpAction, cancelRsvpAction, deleteEventAction, extendSeriesAction, updateEventAction } from "../actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Event" };

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const [e] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!e) notFound();
  const [rsvps, series] = await Promise.all([
    db.select().from(eventRsvps).where(eq(eventRsvps.eventId, e.id)).orderBy(desc(eventRsvps.createdAt)),
    e.seriesId ? db.select({ id: events.id, startAt: events.startAt, status: events.status }).from(events).where(eq(events.seriesId, e.seriesId)).orderBy(asc(events.startAt)) : Promise.resolve([]),
  ]);
  const later = e.seriesId ? (await db.select({ id: events.id }).from(events).where(and(eq(events.seriesId, e.seriesId), gt(events.startAt, e.startAt)))).length : 0;
  const going = rsvps.filter((r) => r.status === "going");
  const people = going.reduce((n, r) => n + r.guests, 0);

  return (
    <div className={a.page}>
      <PageHeader
        back={{ href: "/admin/events", label: "Events" }}
        title={e.title}
        sub={`${fmt(e.startAt, "EEEE, MMMM d")}, ${fmtTimeRange(e.startAt, e.endAt)}${e.venue ? ` · ${e.venue}` : ""}`}
        actions={
          <>
            {e.status === "published" ? <Pill tone="success">On website</Pill> : e.status === "draft" ? <Pill tone="neutral">Draft</Pill> : <Pill tone="danger">Cancelled</Pill>}
            {e.status === "published" && (
              <a className={a.btn} href={`/events/${e.slug}`} target="_blank" rel="noreferrer">
                <Icon name="external" size={15} /> View
              </a>
            )}
          </>
        }
      />
      {sp.created === "1" && (
        <p className={`${a.notice} ${a.noticeOk}`} style={{ marginBottom: 16 }} role="status">
          Event created{series.length > 1 ? ` with ${series.length} dates` : ""}.
        </p>
      )}

      <div className={a.split}>
        <Panel title="Details">
          <div className={a.panelBody}>
            <EventForm action={updateEventAction} event={e} inSeries={later} />
          </div>
        </Panel>

        <div className={a.stack}>
          <Panel
            title="Going"
            count={`${plural(people, "person", "people")}${e.capacity ? ` of ${e.capacity}` : ""}`}
            action={
              rsvps.length ? (
                <a className={a.panelLink} href={`/api/admin/export/rsvps.csv?event=${e.id}`} download>
                  Export CSV
                </a>
              ) : undefined
            }
          >
            {e.meetupUrl && (
              <p className={`${a.small} ${a.muted} ${a.panelBody}`} style={{ paddingBottom: 0 }}>
                RSVPs made on{" "}
                <a href={e.meetupUrl} target="_blank" rel="noreferrer" className={a.ext}>
                  Meetup
                </a>{" "}
                stay there; this list is the website’s.
              </p>
            )}
            {rsvps.length === 0 ? (
              <Empty>No RSVPs yet.</Empty>
            ) : (
              <ul className={a.list}>
                {rsvps.map((r) => (
                  <li key={r.id} className={a.listRow}>
                    <div className={a.listMain}>
                      <div className={a.listTitle} style={r.status === "cancelled" ? { textDecoration: "line-through", color: "var(--a-grey)" } : undefined}>
                        {r.name}
                        {r.guests > 1 && <span className={a.muted}> +{r.guests - 1}</span>}
                      </div>
                      <div className={a.listMeta}>
                        <a href={`mailto:${r.email}`}>{r.email}</a> · {fmt(r.createdAt, "MMM d")}
                        {r.status === "pending_payment" && " · not paid"}
                      </div>
                    </div>
                    {r.status === "going" && (
                      <ActionForm action={cancelRsvpAction} className={a.row} hideMessage>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Remove">
                          Remove
                        </ConfirmSubmit>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <details className={a.disclosure}>
              <summary>Add someone</summary>
              <div className={a.disclosureBody}>
                <ActionForm action={addRsvpAction} resetOnSuccess>
                  <input type="hidden" name="eventId" value={e.id} />
                  <div className={a.field}>
                    <label htmlFor="rs-name">Name</label>
                    <input id="rs-name" name="name" className={a.input} required />
                  </div>
                  <div className={a.formRow}>
                    <div className={a.field}>
                      <label htmlFor="rs-email">Email</label>
                      <input id="rs-email" name="email" type="email" className={a.input} required />
                    </div>
                    <div className={a.field}>
                      <label htmlFor="rs-g">People</label>
                      <input id="rs-g" name="guests" type="number" min={1} max={20} className={a.input} defaultValue={1} />
                    </div>
                  </div>
                  <div className={a.formFoot}>
                    <SubmitButton className={a.btn}>Add</SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </details>
          </Panel>

          {e.seriesId && (
            <Panel title="Series" count={plural(series.length, "date")}>
              <ul className={a.list}>
                {series.map((s) => (
                  <li key={s.id} className={a.listRow}>
                    {s.id === e.id ? (
                      <strong>{fmt(s.startAt, "EEE MMM d, yyyy")} (this one)</strong>
                    ) : (
                      <Link href={`/admin/events/${s.id}`} className={a.rowLink} style={{ fontWeight: 500 }}>
                        {fmt(s.startAt, "EEE MMM d, yyyy")}
                      </Link>
                    )}
                    {s.status !== "published" && <Pill tone={s.status === "cancelled" ? "danger" : "neutral"}>{s.status === "cancelled" ? "Cancelled" : "Draft"}</Pill>}
                  </li>
                ))}
              </ul>
              <details className={a.disclosure}>
                <summary>Add more dates</summary>
                <div className={a.disclosureBody}>
                  <ActionForm action={extendSeriesAction}>
                    <input type="hidden" name="seriesId" value={e.seriesId} />
                    <div className={a.formRow}>
                      <div className={a.field}>
                        <label htmlFor="ex-every">Every</label>
                        <select id="ex-every" name="everyWeeks" className={a.select} defaultValue="2">
                          <option value="1">Week</option>
                          <option value="2">2 weeks</option>
                          <option value="4">4 weeks</option>
                        </select>
                      </div>
                      <div className={a.field}>
                        <label htmlFor="ex-more">More dates</label>
                        <input id="ex-more" name="more" type="number" min={1} max={26} className={a.input} defaultValue={6} />
                      </div>
                    </div>
                    <p className={a.hint}>Copies the last date in the series.</p>
                    <div className={a.formFoot}>
                      <SubmitButton className={a.btn} pendingText="Adding…">
                        Add dates
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </details>
            </Panel>
          )}

          {going.length === 0 && (
            <Panel title="Delete">
              <div className={a.panelBody}>
                <ActionForm action={deleteEventAction} className={a.row}>
                  <input type="hidden" name="id" value={e.id} />
                  <ConfirmSubmit confirmLabel="Delete this date" question="Gone for good.">
                    Delete event…
                  </ConfirmSubmit>
                </ActionForm>
                <p className={a.hint} style={{ marginTop: 8 }}>
                  Once people RSVP, set the status to Cancelled instead.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
