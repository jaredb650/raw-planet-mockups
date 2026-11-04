import { requireAdmin } from "@/lib/auth";
import { BUSINESS } from "@/lib/config";
import { addDaysKey, todayKey, weekdayOf } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { EventForm } from "@/components/admin/EventForm";
import { createEventAction } from "../actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireAdmin();
  // Default to the next Thursday.
  let d = addDaysKey(todayKey(), 1);
  while (weekdayOf(d) !== 4) d = addDaysKey(d, 1);
  return (
    <div className={`${a.page} ${a.pageNarrow}`}>
      <PageHeader back={{ href: "/admin/events", label: "Events" }} title="New event" sub="Set it up once; repeating events create every date for you." />
      <Panel>
        <div className={a.panelBody}>
          <EventForm action={createEventAction} defaults={{ date: d, meetupUrl: BUSINESS.meetupGroupUrl || undefined }} />
        </div>
      </Panel>
    </div>
  );
}
