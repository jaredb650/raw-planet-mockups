import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAttention, getKpis, getSessions, weekStartKey } from "@/lib/admin/dashboard";
import { addDaysKey, fmt, fmtDateLong, fmtTime, fromLocal, localDateKey, todayKey } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { SessionList } from "@/components/admin/SessionList";
import { RevenueBars } from "@/components/admin/RevenueBars";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Icon } from "@/components/admin/Icon";
import { SOURCE_LABEL, plural } from "@/components/admin/format";
import { calendarResolvedAction } from "./bookings/actions";
import type { BookingSource } from "@/lib/db/schema";
import a from "@/components/admin/admin.module.css";
import t from "@/components/admin/today.module.css";

export const metadata = { title: "Today" };

const SOURCE_COLOR: Record<string, string> = {
  direct: "var(--brick)",
  airbnb: "#e0565b",
  viator: "#2f7d73",
  manual: "var(--olive)",
  phone: "var(--ochre)",
  cal: "#5a7fa0",
};

export default async function TodayPage() {
  await requireAdmin();
  const now = new Date();
  const today = todayKey(now);
  const tomorrow = addDaysKey(today, 1);
  const [sessions, kpis, att] = await Promise.all([
    getSessions(fromLocal(today), fromLocal(addDaysKey(today, 2))),
    getKpis(now),
    getAttention(now),
  ]);
  const todays = sessions.filter((s) => localDateKey(new Date(s.startAt)) === today);
  const tomorrows = sessions.filter((s) => localDateKey(new Date(s.startAt)) === tomorrow);
  const next = sessions.find((s) => new Date(s.endAt) > now && s.status === "confirmed");

  const subParts = [fmtDateLong(now)];
  if (next) {
    const live = new Date(next.startAt) <= now;
    subParts.push(
      live
        ? `${next.contactName} is in session now`
        : `Next: ${next.contactName}, ${localDateKey(new Date(next.startAt)) === today ? "" : "tomorrow "}${fmtTime(next.startAt)}`,
    );
  } else subParts.push("Nothing else booked today or tomorrow");

  const delta = kpis.revenueThisMonth - kpis.revenueLastMonthToDate;
  const deltaPct = kpis.revenueLastMonthToDate > 0 ? Math.round((delta / kpis.revenueLastMonthToDate) * 100) : null;
  const attentionCount =
    att.calendarErrors.length + att.deliverables.length + att.inquiries.length + att.reviews.length + att.failedEmails.length + att.feeds.length;

  return (
    <div className={a.page}>
      <PageHeader
        title="Today"
        sub={subParts.join(" · ")}
        actions={
          <>
            <Link href="/admin/availability#block" className={a.btn}>
              <Icon name="availability" size={16} /> Block time
            </Link>
            <Link href="/admin/bookings/new" className={`${a.btn} ${a.btnPrimary}`}>
              <Icon name="plus" size={16} /> New booking
            </Link>
          </>
        }
      />

      <div className={a.splitWide}>
        <div className={a.stack}>
          <Panel
            title={<span className={t.dayHead}>Today <span className={a.muted} style={{ fontWeight: 500 }}>{fmt(now, "EEE MMM d")}</span></span>}
            count={todays.length ? plural(todays.length, "session") : undefined}
            action={<Link className={a.panelLink} href={`/admin/calendar?view=day&date=${today}`}>Calendar</Link>}
          >
            {todays.length ? <SessionList sessions={todays} now={now} /> : <Empty>No sessions today.</Empty>}
          </Panel>
          <Panel
            title={<span className={t.dayHead}>Tomorrow <span className={a.muted} style={{ fontWeight: 500 }}>{fmt(fromLocal(tomorrow, "12:00"), "EEE MMM d")}</span></span>}
            count={tomorrows.length ? plural(tomorrows.length, "session") : undefined}
          >
            {tomorrows.length ? <SessionList sessions={tomorrows} now={now} /> : <Empty>Nothing booked tomorrow.</Empty>}
          </Panel>
        </div>

        <Panel title="Needs attention" count={attentionCount || undefined}>
          {attentionCount === 0 && att.holds.length === 0 ? (
            <p className={t.allClear}>
              <Icon name="check" size={16} /> All clear. Nothing waiting on you.
            </p>
          ) : (
            <ul className={t.att}>
              {att.calendarErrors.map((c) => (
                <li key={c.eventId}>
                  <div className={t.attMain}>
                    <span className={t.attKind}>Calendar sync failed</span>
                    <Link href={`/admin/bookings/${c.bookingId}`} className={t.attTitle}>
                      {c.name} · {c.code}
                    </Link>
                    <p className={t.attText}>{c.message}</p>
                  </div>
                  <div className={t.attAction}>
                    <ActionForm action={calendarResolvedAction} className={a.row} hideMessage>
                      <input type="hidden" name="id" value={c.bookingId} />
                      <SubmitButton className={`${a.btn} ${a.btnSm}`} pendingText="…">
                        Mark fixed
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
              {att.feeds.map((f) => (
                <li key={f.id}>
                  <div className={t.attMain}>
                    <span className={t.attKind}>Calendar feed failing</span>
                    <Link href="/admin/availability#feeds" className={t.attTitle}>{f.name}</Link>
                    <p className={t.attText}>{f.error}</p>
                  </div>
                </li>
              ))}
              {att.deliverables.map((d) => (
                <li key={d.id}>
                  <div className={t.attMain}>
                    <span className={t.attKind}>Track to deliver · {d.status === "in_progress" ? "in progress" : "not started"}</span>
                    <Link href={`/admin/bookings/${d.id}#deliverable`} className={t.attTitle}>
                      {d.name}
                    </Link>
                    <p className={t.attText}>
                      {d.experience}, {fmt(d.startAt, "MMM d")}
                    </p>
                  </div>
                </li>
              ))}
              {att.inquiries.map((i) => (
                <li key={i.id}>
                  <div className={t.attMain}>
                    <span className={t.attKind}>
                      New inquiry · {i.kind.replace("_", " ")}
                      {i.groupSize ? `, ${i.groupSize} people` : ""}
                    </span>
                    <Link href={`/admin/inquiries?open=${i.id}`} className={t.attTitle}>{i.name}</Link>
                    <p className={t.attText}>{i.message}</p>
                  </div>
                </li>
              ))}
              {att.reviews.map((r) => (
                <li key={r.id}>
                  <div className={t.attMain}>
                    <span className={t.attKind}>Review to approve · {r.rating}★</span>
                    <Link href="/admin/reviews?status=pending" className={t.attTitle}>{r.name}</Link>
                    <p className={t.attText}>{r.body}</p>
                  </div>
                </li>
              ))}
              {att.failedEmails.map((m) => (
                <li key={m.id}>
                  <div className={t.attMain}>
                    <span className={t.attKind}>Email failed</span>
                    <Link href={`/admin/emails?status=failed`} className={t.attTitle}>{m.subject}</Link>
                    <p className={t.attText}>
                      To {m.to}
                      {m.error ? `: ${m.error}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {att.holds.map((h) => (
                <li key={h.id}>
                  <div className={t.attMain}>
                    <span className={t.attKind}>Guest checking out now</span>
                    <Link href={`/admin/bookings/${h.id}`} className={t.attTitle}>{h.name}</Link>
                    <p className={t.attText}>
                      {h.experience}, {fmt(h.startAt, "EEE MMM d, h:mmaaa")}
                      {h.expiresAt ? `. Hold ends ${fmtTime(h.expiresAt)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className={a.section}>
        <div className={a.kpis} style={{ ["--kpi-cols" as string]: 4 }}>
          <div className={a.kpi}>
            <div className={a.kpiLabel}>Revenue this month</div>
            <div className={`${a.kpiValue} ${a.kpiValueLead}`}>{formatMoney(kpis.revenueThisMonth)}</div>
            <div className={a.kpiNote}>
              {deltaPct === null ? (
                <>Last month: {formatMoney(kpis.revenueLastMonth)}</>
              ) : (
                <>
                  <span className={delta >= 0 ? a.up : a.down}>
                    {delta >= 0 ? "+" : ""}
                    {deltaPct}%
                  </span>{" "}
                  vs. same point last month
                </>
              )}
            </div>
          </div>
          <div className={a.kpi}>
            <div className={a.kpiLabel}>Sessions this week</div>
            <div className={a.kpiValue}>{kpis.sessionsThisWeek}</div>
            <div className={a.kpiNote}>
              {plural(kpis.newBookingsThisWeek, "new booking")} since {fmt(fromLocal(weekStartKey(today), "12:00"), "EEE")}
            </div>
          </div>
          <div className={a.kpi}>
            <div className={a.kpiLabel}>Upcoming confirmed</div>
            <div className={a.kpiValue}>{kpis.upcomingConfirmed}</div>
            <div className={a.kpiNote}>{plural(kpis.upcomingGuests, "guest")} booked ahead</div>
          </div>
          <div className={a.kpi}>
            <div className={a.kpiLabel}>Average party</div>
            <div className={a.kpiValue}>
              {kpis.avgParty === null ? <span className={a.dash}>–</span> : kpis.avgParty.toFixed(1)}
              <span className={a.kpiUnit}>guests</span>
            </div>
            <div className={a.kpiNote}>Last 90 days</div>
          </div>
        </div>
      </div>

      <div className={`${a.section} ${a.grid2}`}>
        <Panel title="Net revenue, last 30 days" action={<Link className={a.panelLink} href="/admin/bookings?view=past">Past bookings</Link>}>
          <div className={a.panelBody}>
            <RevenueBars data={kpis.daily} />
          </div>
        </Panel>
        <Panel title="Where bookings come from" count="last 90 days">
          <div className={a.panelBody}>
            {kpis.mixTotal === 0 ? (
              <p className={a.muted}>No sessions in the last 90 days yet.</p>
            ) : (
              <>
                <div className={t.mixBar} role="img" aria-label={kpis.mix.map((m) => `${SOURCE_LABEL[m.source as BookingSource] ?? m.source} ${m.count}`).join(", ")}>
                  {kpis.mix.map((m) => (
                    <span key={m.source} style={{ width: `${(m.count / kpis.mixTotal) * 100}%`, background: SOURCE_COLOR[m.source] ?? "var(--ink-faint)" }} />
                  ))}
                </div>
                <ul className={t.mixList}>
                  {kpis.mix.map((m) => (
                    <li key={m.source}>
                      <span className={t.mixDot} style={{ background: SOURCE_COLOR[m.source] ?? "var(--ink-faint)" }} />
                      <span className={t.mixName}>{SOURCE_LABEL[m.source as BookingSource] ?? m.source}</span>
                      <span className={a.num}>{m.count}</span>
                      <span className={`${a.num} ${a.muted}`} style={{ width: 44 }}>
                        {Math.round((m.count / kpis.mixTotal) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
                <p className={`${a.small} ${a.muted}`} style={{ marginTop: 12 }}>
                  Airbnb and Viator bookings only count here once they are added under Bookings → New, or imported from the calendar.
                </p>
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
