import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { experienceOptions } from "@/lib/admin/bookings";
import { todayKey } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { NewBookingForm, type NewBookingPrefill } from "@/components/admin/NewBookingForm";
import { createManualAction } from "../actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "New booking" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const exps = await experienceOptions();
  const prefill: NewBookingPrefill = {};
  const date = one(sp.date);
  const time = one(sp.time);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) prefill.date = date;
  if (/^\d{2}:\d{2}$/.test(time)) prefill.time = time;
  if (one(sp.exp)) prefill.experienceId = one(sp.exp);
  if (["airbnb", "viator", "phone", "manual"].includes(one(sp.source))) prefill.source = one(sp.source);

  let fromInquiry: string | null = null;
  const inquiryId = one(sp.inquiry);
  if (inquiryId) {
    const db = await getDb();
    const [inq] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId)).limit(1);
    if (inq) {
      fromInquiry = inq.name;
      Object.assign(prefill, {
        inquiryId: inq.id,
        name: inq.name,
        email: inq.email,
        phone: inq.phone ?? undefined,
        guests: inq.groupSize ?? undefined,
        experienceId: prefill.experienceId ?? inq.experienceId ?? undefined,
        notes: inq.message ? `From inquiry: ${inq.message}` : undefined,
      } satisfies NewBookingPrefill);
      if (!prefill.date && inq.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(inq.preferredDate)) prefill.date = inq.preferredDate;
    }
  }

  return (
    <div className={`${a.page} ${a.pageNarrow}`}>
      <PageHeader
        back={{ href: fromInquiry ? "/admin/inquiries" : "/admin/bookings", label: fromInquiry ? "Inquiries" : "Bookings" }}
        title="New booking"
        sub={fromInquiry ? `Turning ${fromInquiry}’s inquiry into a booking.` : "For phone bookings, Airbnb and Viator. It blocks the time on the website straight away."}
      />
      <Panel>
        <div className={a.panelBody}>
          <NewBookingForm
            action={createManualAction}
            today={todayKey()}
            prefill={prefill}
            experiences={exps.map((e) => ({
              id: e.id,
              name: e.shortName,
              durations: e.durationOptions.map((o) => o.minutes),
              minGuests: e.minGuests,
              maxGuests: e.maxGuests,
              active: e.active,
            }))}
          />
        </div>
      </Panel>
    </div>
  );
}
