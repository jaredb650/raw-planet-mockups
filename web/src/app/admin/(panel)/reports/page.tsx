import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getReport, parseRange, RANGE_PRESETS, type Bar } from "@/lib/admin/reports";
import { fmt, fromLocal } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { Bars, OccupancyHeatmap } from "@/components/admin/Charts";
import { Icon } from "@/components/admin/Icon";
import { plural } from "@/components/admin/format";
import a from "@/components/admin/admin.module.css";
import s from "@/components/admin/insights.module.css";

export const metadata = { title: "Reports" };

const rate = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`);
const moneyBars = (rows: Bar[]) => rows.map((r) => ({ key: r.key, label: r.label, value: r.cents, text: formatMoney(r.cents) }));
const dateLabel = (k: string) => fmt(fromLocal(k, "12:00"), "MMM d, yyyy");

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.pair}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const range = parseRange(await searchParams);
  const r = await getReport(range);
  const q = new URLSearchParams({ from: range.from, to: range.to });
  const rev = r.revenue;
  const occupancyRate = r.occupancy.openHours ? r.occupancy.bookedHours / r.occupancy.openHours : null;
  const held = r.rates.sessions - r.rates.cancelled;

  return (
    <div className={a.page}>
      <PageHeader
        title="Reports"
        sub={`${dateLabel(range.from)} to ${dateLabel(range.to)}`}
        actions={
          <a href={`/api/admin/export/report.csv?${q}`} className={a.btn} download>
            <Icon name="download" size={16} /> Export CSV
          </a>
        }
      />

      <nav className={a.tabs} aria-label="Date range">
        {RANGE_PRESETS.map((p) => (
          <Link key={p.key} href={`/admin/reports?preset=${p.key}`} className={`${a.tab} ${range.preset === p.key ? a.tabActive : ""}`} aria-current={range.preset === p.key ? "true" : undefined}>
            {p.label}
          </Link>
        ))}
      </nav>
      <form method="get" className={a.filters}>
        <div className={a.field}>
          <label htmlFor="rp-from">From</label>
          <input id="rp-from" name="from" type="date" className={a.input} defaultValue={range.from} required />
        </div>
        <div className={a.field}>
          <label htmlFor="rp-to">To</label>
          <input id="rp-to" name="to" type="date" className={a.input} defaultValue={range.to} required />
        </div>
        <button type="submit" className={a.btn}>
          Show
        </button>
      </form>

      <div className={a.kpis} style={{ ["--kpi-cols" as string]: 4 }}>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Net revenue</div>
          <div className={`${a.kpiValue} ${a.kpiValueLead}`}>{formatMoney(rev.totalCents)}</div>
          <div className={a.kpiNote}>
            {formatMoney(rev.sessionCents)} sessions, {formatMoney(rev.giftCardCents)} gift cards, {formatMoney(rev.refundCents)} refunded
          </div>
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Sessions</div>
          <div className={a.kpiValue}>{held}</div>
          <div className={a.kpiNote}>{r.rates.cancelled} more cancelled</div>
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Average booking</div>
          <div className={a.kpiValue}>{r.average.cents === null ? <span className={a.dash}>–</span> : formatMoney(r.average.cents)}</div>
          <div className={a.kpiNote}>{plural(r.average.count, "paid session")}</div>
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Repeat guests</div>
          <div className={a.kpiValue}>{rate(r.repeat.rate)}</div>
          <div className={a.kpiNote}>
            {r.repeat.repeat} of {plural(r.repeat.guests, "guest")} had been before or came twice
          </div>
        </div>
      </div>

      <div className={`${a.section} ${a.grid3}`}>
        <Panel title="Revenue by month">
          <div className={a.panelBody}>
            <Bars label="Net revenue by month" rows={moneyBars(rev.byMonth)} />
          </div>
        </Panel>
        <Panel title="Revenue by experience">
          <div className={a.panelBody}>
            {rev.byExperience.length ? <Bars label="Net revenue by experience" rows={moneyBars(rev.byExperience)} /> : <p className={a.muted}>No money in or out in this range.</p>}
          </div>
        </Panel>
        <Panel title="Revenue by source">
          <div className={a.panelBody}>
            {rev.bySource.length ? <Bars label="Net revenue by source" rows={moneyBars(rev.bySource)} /> : <p className={a.muted}>No money in or out in this range.</p>}
          </div>
        </Panel>
      </div>
      <p className={`${a.hint} ${a.small}`} style={{ marginTop: 8 }}>
        Revenue is money actually received, the same figure as the Today page: card payments when confirmed, plus gift cards sold, minus refunds when issued. A refund counts in the month it was paid back. Airbnb and Viator money only appears if you typed it on the booking.
      </p>

      <div className={a.section}>
        <Panel title="Studio occupancy" count={occupancyRate === null ? undefined : `${rate(occupancyRate)} overall`}>
          <div className={a.panelBody}>
            {r.occupancy.cells.length === 0 ? (
              <p className={a.muted}>No open hours in this range.</p>
            ) : (
              <>
                <OccupancyHeatmap cells={r.occupancy.cells} />
                <p className={a.hint} style={{ marginTop: 10 }}>
                  {Math.round(r.occupancy.bookedHours)} of {Math.round(r.occupancy.openHours)} open hours booked. Open hours are your current weekly hours minus time you blocked off, including imported calendars.
                </p>
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className={`${a.section} ${a.grid2}`}>
        <Panel title="How far ahead guests book" count={r.leadTime.medianDays === null ? undefined : `typically ${Math.round(r.leadTime.medianDays)} days`}>
          <div className={a.panelBody}>
            {r.leadTime.count === 0 ? (
              <p className={a.muted}>No website or Cal.com bookings in this range.</p>
            ) : (
              <>
                <Bars label="Bookings by days ahead" rows={r.leadTime.buckets.map((b) => ({ key: b.label, label: b.label, value: b.count, text: String(b.count) }))} />
                <p className={a.hint} style={{ marginTop: 10 }}>
                  Website and Cal.com only. Bookings you typed in are left out, because they were entered after the guest booked.
                </p>
              </>
            )}
          </div>
        </Panel>
        <Panel title="Cancellations and no-shows">
          <div className={a.panelBody}>
            <Pair label="Sessions booked" value={String(r.rates.sessions)} />
            <Pair label="Cancelled" value={`${r.rates.cancelled} (${rate(r.rates.cancelRate)})`} />
            <Pair label="No-shows" value={`${r.rates.noShows} of ${r.rates.started} started (${rate(r.rates.noShowRate)})`} />
          </div>
        </Panel>
      </div>

      <div className={`${a.section} ${a.grid2}`}>
        <Panel title="Gift cards">
          <div className={a.panelBody}>
            <Pair label={`Sold (${r.giftCards.soldCount})`} value={formatMoney(r.giftCards.soldCents)} />
            <Pair label="Redeemed" value={formatMoney(r.giftCards.redeemedCents)} />
            <Pair label="Still unspent today, all time" value={formatMoney(r.giftCards.outstandingCents)} />
          </div>
        </Panel>
        <Panel title="Smart pricing impact" count={r.smartPricing.bookings ? plural(r.smartPricing.bookings, "booking") : undefined}>
          <div className={a.panelBody}>
            {r.smartPricing.bookings === 0 ? (
              <p className={a.muted}>No session in this range was priced by a rule.</p>
            ) : (
              <>
                <Pair label="Net change from normal prices" value={formatMoney(r.smartPricing.netCents)} />
                <Pair label="Added by higher prices" value={formatMoney(r.smartPricing.addedCents)} />
                <Pair label="Given away in lower prices" value={formatMoney(r.smartPricing.givenCents)} />
                {r.smartPricing.rules.map((x) => (
                  <Pair key={x.name} label={`${x.name} (${x.bookings})`} value={formatMoney(x.cents)} />
                ))}
                <p className={a.hint} style={{ marginTop: 10 }}>
                  Compared with normal prices. It can&rsquo;t say whether a guest would have booked anyway.
                </p>
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className={`${a.section} ${a.grid2}`}>
        <Panel title="Promo codes">
          {r.promos.length === 0 ? (
            <Empty>No promo codes used on sessions in this range.</Empty>
          ) : (
            <div className={a.tableWrap}>
              <table className={a.table}>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col" className={a.num}>Uses</th>
                    <th scope="col" className={a.num}>Discount</th>
                    <th scope="col" className={a.num}>Booking value</th>
                  </tr>
                </thead>
                <tbody>
                  {r.promos.map((p) => (
                    <tr key={p.code}>
                      <td className={a.code}>{p.code}</td>
                      <td className={a.num}>{p.uses}</td>
                      <td className={a.num}>{formatMoney(p.discountCents)}</td>
                      <td className={a.num}>{formatMoney(p.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Abandoned checkouts">
          <div className={a.panelBody}>
            <Pair label="Checkouts not finished" value={String(r.abandoned.expired)} />
            <Pair label="“Still want it?” emails sent" value={String(r.abandoned.sent)} />
            <Pair label="Booked within 7 days" value={`${r.abandoned.recovered} (${rate(r.abandoned.rate)})`} />
            <Pair label="Value of those bookings" value={formatMoney(r.abandoned.revenueCents)} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
