import Link from "next/link";
import { dateKeySchema } from "@/app/api/_lib/http";
import { requireAdmin } from "@/lib/auth";
import { getSessions } from "@/lib/admin/dashboard";
import { canCheckIn } from "@/lib/booking/service";
import { formatMoney } from "@/lib/money";
import { addDaysKey, fmt, fmtTimeRange, fromLocal, todayKey } from "@/lib/time";
import { CheckInButton } from "@/components/admin/CheckInButton";
import { Icon } from "@/components/admin/Icon";
import { PrintButton } from "@/components/admin/PrintButton";
import { BOOKING_STATUS, plural } from "@/components/admin/format";
import type { BookingStatus } from "@/lib/db/schema";
import a from "@/components/admin/admin.module.css";
import m from "@/components/admin/manifest.module.css";

export const metadata = { title: "Manifest" };

export default async function ManifestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const now = new Date();
  const parsed = dateKeySchema.safeParse((await searchParams).date);
  const date = parsed.success ? parsed.data : todayKey(now);
  const sessions = await getSessions(fromLocal(date), fromLocal(addDaysKey(date, 1)));

  const guests = sessions.reduce((n, s) => n + s.guests, 0);
  const owed = sessions.reduce((n, s) => n + s.owedCents, 0);
  const unsigned = sessions.reduce((n, s) => n + (s.waiverRequired ? Math.max(0, s.guests - s.waiversSigned) : 0), 0);
  const summary = [
    plural(sessions.length, "session"),
    plural(guests, "guest"),
    owed ? `${formatMoney(owed)} owed` : null,
    unsigned ? `${plural(unsigned, "waiver")} to sign` : null,
  ].filter(Boolean);
  const dayLink = (key: string) => `/admin/manifest?date=${key}`;
  const day = fromLocal(date, "12:00");

  return (
    <div className={`${a.root} ${m.sheet}`}>
      <nav className={`${m.bar} ${m.noPrint}`} aria-label="Manifest days">
        <Link href="/admin" className={`${a.btn} ${a.btnGhost}`}>
          <Icon name="left" size={15} /> Today page
        </Link>
        <Link href={dayLink(addDaysKey(date, -1))} className={a.btn}>
          <Icon name="left" size={15} /> {fmt(fromLocal(addDaysKey(date, -1), "12:00"), "EEE MMM d")}
        </Link>
        <Link href={dayLink(addDaysKey(date, 1))} className={a.btn}>
          {fmt(fromLocal(addDaysKey(date, 1), "12:00"), "EEE MMM d")} <Icon name="right" size={15} />
        </Link>
        <span className={m.push}>
          <PrintButton />
        </span>
      </nav>

      <h1 className={m.title}>Manifest · {fmt(day, "EEEE, MMMM d, yyyy")}</h1>
      <p className={m.sub}>
        {summary.join(" · ")} · as of {fmt(now, "MMM d, h:mmaaa")}
      </p>

      {sessions.length === 0 ? (
        <p>No sessions on this day.</p>
      ) : (
        <table className={m.table}>
          <caption className="sr-only">Sessions on {fmt(day, "MMMM d")}</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Experience</th>
              <th scope="col">Guest</th>
              <th scope="col">Party</th>
              <th scope="col">Details</th>
              <th scope="col">Notes</th>
              <th scope="col">Waivers</th>
              <th scope="col">Owed</th>
              <th scope="col">Checked in</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const checkedIn = Boolean(s.checkedInAt) && s.status !== "no_show";
              return (
                <tr key={s.id}>
                  <td data-label="Time" className={m.time}>{fmtTimeRange(s.startAt, s.endAt)}</td>
                  <td data-label="Experience">{s.experienceName}</td>
                  <td data-label="Guest">
                    <span>
                      <Link href={`/admin/bookings/${s.id}`} className={m.guest}>{s.contactName}</Link>
                      <span className={m.line}>{s.contactPhone ?? "No phone"}</span>
                      {s.status !== "confirmed" && <span className={m.line}>{BOOKING_STATUS[s.status as BookingStatus]?.label ?? s.status}</span>}
                    </span>
                  </td>
                  <td data-label="Party">{s.guests}</td>
                  <td data-label="Details">
                    <span>
                      {s.occasion && <span className={m.line}>{s.occasion}</span>}
                      {s.isGift && <span className={m.line}>Gift{s.giftRecipientName ? ` for ${s.giftRecipientName}` : ""}</span>}
                      <span className={m.line}>{s.language === "es" ? "Spanish" : "English"}</span>
                    </span>
                  </td>
                  <td data-label="Notes">
                    <span>
                      {s.customerNotes && <span className={m.line}>Guest: {s.customerNotes}</span>}
                      {s.internalNotes && <span className={m.line}>Private: {s.internalNotes}</span>}
                    </span>
                  </td>
                  <td data-label="Waivers">
                    {s.waiverRequired ? (
                      <span>
                        <span className={`${m.line} ${s.waiversSigned < s.guests ? m.strong : ""}`}>{s.waiversSigned} of {s.guests} signed</span>
                        {s.recordingDeclined > 0 && <span className={m.line}>{s.recordingDeclined} no recording</span>}
                      </span>
                    ) : (
                      "Not needed"
                    )}
                  </td>
                  <td data-label="Owed" className={s.owedCents > 0 ? m.strong : undefined}>{formatMoney(s.owedCents)}</td>
                  <td data-label="Checked in">
                    <span className={m.checkCell}>
                      <span className={m.box} aria-hidden>{checkedIn ? "✓" : ""}</span>
                      <span className="sr-only">{checkedIn ? "Yes" : "No"}</span>
                      {canCheckIn(s, now) && (
                        <span className={m.noPrint}>
                          <CheckInButton id={s.id} guest={s.contactName} checkedIn={checkedIn} />
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
