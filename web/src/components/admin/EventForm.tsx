import { ActionForm, InlineMessage, SubmitButton } from "./ActionForm";
import type { FormAction } from "./types";
import type { CommunityEvent } from "@/lib/db/schema";
import { fmt, localDateKey } from "@/lib/time";
import a from "./admin.module.css";

const hhmm = (d: Date) => fmt(d, "HH:mm");

/** Create or edit a community event. On create it offers weekly / biweekly / monthly repeats. */
export function EventForm({
  action,
  event,
  defaults,
  inSeries,
}: {
  action: FormAction;
  event?: CommunityEvent;
  defaults?: { date: string; meetupUrl?: string };
  inSeries?: number;
}) {
  const e = event;
  return (
    <ActionForm action={action} hideMessage>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className={a.field}>
        <label htmlFor="ev-title">Title</label>
        <input id="ev-title" name="title" className={a.input} defaultValue={e?.title} required placeholder="Producers’ Meetup" />
      </div>
      <div className={a.formRow} style={{ ["--cols" as string]: 3 }}>
        <div className={a.field}>
          <label htmlFor="ev-date">{e ? "Date" : "First date"}</label>
          <input id="ev-date" name="date" type="date" className={a.input} defaultValue={e ? localDateKey(e.startAt) : defaults?.date} required />
        </div>
        <div className={a.field}>
          <label htmlFor="ev-start">Starts</label>
          <input id="ev-start" name="startTime" type="time" step={900} className={a.input} defaultValue={e ? hhmm(e.startAt) : "19:00"} required />
        </div>
        <div className={a.field}>
          <label htmlFor="ev-end">Ends</label>
          <input id="ev-end" name="endTime" type="time" step={900} className={a.input} defaultValue={e ? hhmm(e.endAt) : "21:30"} required />
        </div>
      </div>
      {!e && (
        <div className={a.formRow}>
          <div className={a.field}>
            <label htmlFor="ev-rep">Repeats</label>
            <select id="ev-rep" name="repeat" className={a.select} defaultValue="biweekly">
              <option value="none">Just once</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly (same weekday)</option>
            </select>
          </div>
          <div className={a.field}>
            <label htmlFor="ev-occ">How many dates</label>
            <input id="ev-occ" name="occurrences" type="number" min={2} max={26} className={a.input} defaultValue={6} />
            <span className={a.hint}>You can add more later.</span>
          </div>
        </div>
      )}
      <div className={a.field}>
        <label htmlFor="ev-sum">Short summary</label>
        <input id="ev-sum" name="summary" className={a.input} defaultValue={e?.summary} maxLength={400} placeholder="Bring a beat, get feedback, meet other producers." />
      </div>
      <div className={a.field}>
        <label htmlFor="ev-desc">Description</label>
        <textarea id="ev-desc" name="description" className={a.textarea} defaultValue={e?.description} rows={6} />
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor="ev-venue">Venue</label>
          <input id="ev-venue" name="venue" className={a.input} defaultValue={e?.venue} />
        </div>
        <div className={a.field}>
          <label htmlFor="ev-addr">Address</label>
          <input id="ev-addr" name="address" className={a.input} defaultValue={e?.address} />
        </div>
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor="ev-meetup">Meetup link</label>
          <input id="ev-meetup" name="meetupUrl" type="url" className={a.input} defaultValue={e?.meetupUrl ?? defaults?.meetupUrl ?? ""} placeholder="https://www.meetup.com/…" />
        </div>
        <div className={a.field}>
          <label htmlFor="ev-tix">Other ticket link</label>
          <input id="ev-tix" name="externalTicketUrl" type="url" className={a.input} defaultValue={e?.externalTicketUrl ?? ""} placeholder="Eventbrite, Partiful…" />
        </div>
      </div>
      <div className={a.formRow} style={{ ["--cols" as string]: 3 }}>
        <div className={a.field}>
          <label htmlFor="ev-cap">Capacity</label>
          <input id="ev-cap" name="capacity" type="number" min={1} className={a.input} defaultValue={e?.capacity ?? ""} placeholder="No limit" />
        </div>
        <div className={a.field}>
          <label htmlFor="ev-price">Price ($)</label>
          <input id="ev-price" name="price" inputMode="decimal" className={a.input} defaultValue={e?.priceCents ? (e.priceCents / 100).toFixed(0) : ""} placeholder="Free" />
        </div>
        <div className={a.field}>
          <label htmlFor="ev-img">Image (optional)</label>
          <input id="ev-img" name="imageUrl" className={a.input} defaultValue={e?.imageUrl ?? ""} placeholder="/media/… or https://" />
        </div>
      </div>
      <label className={a.check}>
        <input type="checkbox" name="rsvpEnabled" defaultChecked={e?.rsvpEnabled ?? true} />
        <span>
          Let people RSVP on the website
          <span className={a.cellSub}>Untick if RSVPs only happen on Meetup.</span>
        </span>
      </label>
      {e ? (
        <div className={a.field} style={{ maxWidth: 260 }}>
          <label htmlFor="ev-status">Status</label>
          <select id="ev-status" name="status" className={a.select} defaultValue={e.status}>
            <option value="published">On the website</option>
            <option value="draft">Draft (hidden)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      ) : (
        <label className={a.check}>
          <input type="checkbox" name="publish" defaultChecked />
          <span>Put it on the website now</span>
        </label>
      )}
      {e && inSeries ? (
        <label className={a.check}>
          <input type="checkbox" name="applyToSeries" />
          <span>
            Also apply to the {inSeries} later date{inSeries === 1 ? "" : "s"} in this series
            <span className={a.cellSub}>Copies the title, times, place, links and details. Each keeps its own date and status.</span>
          </span>
        </label>
      ) : null}
      <div className={a.formFoot}>
        <SubmitButton pendingText="Saving…">{e ? "Save event" : "Create event"}</SubmitButton>
        <InlineMessage />
      </div>
    </ActionForm>
  );
}
