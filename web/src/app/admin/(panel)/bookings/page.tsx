import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { VIEWS, VIEW_LABEL, experienceOptions, filterQuery, listBookings, parseBookingFilters, PAGE_SIZE } from "@/lib/admin/bookings";
import { fmt, fmtTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { BookingStatusPill, ExpName, PaymentPill, Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import { SOURCE_LABEL } from "@/components/admin/format";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const f = parseBookingFilters(await searchParams);
  const [{ rows, hasMore, counts }, exps] = await Promise.all([listBookings(f), experienceOptions()]);
  const filtered = Boolean(f.q || f.source || f.exp || f.from || f.to);

  return (
    <div className={a.page}>
      <PageHeader
        title="Bookings"
        sub="Every booking from the website, Airbnb, Viator and the phone, in one list."
        actions={
          <>
            <a href={`/api/admin/export/bookings.csv${filterQuery(f, { page: 1 })}`} className={a.btn} download>
              <Icon name="download" size={16} /> Export CSV
            </a>
            <Link href="/admin/bookings/new" className={`${a.btn} ${a.btnPrimary}`}>
              <Icon name="plus" size={16} /> New booking
            </Link>
          </>
        }
      />

      <nav className={a.tabs} aria-label="Booking views">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={`/admin/bookings${filterQuery(f, { view: v, page: 1 })}`}
            className={`${a.tab} ${f.view === v ? a.tabActive : ""}`}
            aria-current={f.view === v ? "page" : undefined}
          >
            {VIEW_LABEL[v]}
            <span className={a.tabCount}>{counts[v]}</span>
          </Link>
        ))}
      </nav>

      <form className={a.filters} method="get" role="search" aria-label="Filter bookings">
        {f.view !== "upcoming" && <input type="hidden" name="view" value={f.view} />}
        <div className={`${a.field} ${a.grow}`}>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" className={a.input} defaultValue={f.q} placeholder="Name, email, phone, RP- code or Airbnb ref" />
        </div>
        <div className={a.field}>
          <label htmlFor="source">Source</label>
          <select id="source" name="source" className={a.select} defaultValue={f.source}>
            <option value="">All sources</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className={a.field}>
          <label htmlFor="exp">Experience</label>
          <select id="exp" name="exp" className={a.select} defaultValue={f.exp}>
            <option value="">All experiences</option>
            {exps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.shortName}
              </option>
            ))}
          </select>
        </div>
        <div className={a.field}>
          <label htmlFor="from">From</label>
          <input id="from" name="from" type="date" className={a.input} defaultValue={f.from} />
        </div>
        <div className={a.field}>
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="date" className={a.input} defaultValue={f.to} />
        </div>
        <div className={a.row}>
          <button type="submit" className={`${a.btn} ${a.btnPrimary}`}>
            Apply
          </button>
          {filtered && (
            <Link className={`${a.btn} ${a.btnGhost}`} href={`/admin/bookings${filterQuery({ ...f, q: "", source: "", exp: "", from: "", to: "", page: 1 })}`}>
              Clear
            </Link>
          )}
        </div>
      </form>

      <Panel>
        {rows.length === 0 ? (
          <Empty>
            {filtered ? "No bookings match these filters." : f.view === "upcoming" ? "Nothing booked ahead yet." : "No bookings here yet."}
          </Empty>
        ) : (
          <div className={a.tableWrap}>
            <table className={`${a.table} ${a.tableStack}`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Guest</th>
                  <th>Experience</th>
                  <th className={a.num}>Guests</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th className={a.num}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className={a.nowrap}>
                      <Link href={`/admin/bookings/${b.id}`} className={a.rowLink}>
                        {fmt(b.startAt, "EEE MMM d")}
                        {b.startAt.getFullYear() !== new Date().getFullYear() ? fmt(b.startAt, ", yyyy") : ""}
                      </Link>
                      <span className={a.cellSub}>{fmtTimeRange(b.startAt, b.endAt)}</span>
                    </td>
                    <td>
                      <Link href={`/admin/bookings/${b.id}`} className={a.rowLink}>
                        {b.contactName}
                      </Link>
                      <span className={`${a.cellSub} ${a.hideSm}`}>
                        <span className={a.code}>{b.code}</span>
                        {b.occasion ? ` · ${b.occasion}` : ""}
                        {b.isGift ? " · Gift" : ""}
                      </span>
                    </td>
                    <td>
                      <ExpName theme={b.theme} name={b.experienceName} />
                    </td>
                    <td className={a.num} data-label="Guests">
                      {b.guests}
                    </td>
                    <td>
                      {SOURCE_LABEL[b.source] ?? b.source}
                      {b.externalRef && <span className={`${a.cellSub} ${a.mono}`}>{b.externalRef}</span>}
                    </td>
                    <td>
                      <span className={a.row} style={{ gap: 4 }}>
                        <BookingStatusPill status={b.status} />
                        {b.paymentStatus !== "paid" && b.paymentStatus !== "not_required" && <PaymentPill status={b.paymentStatus} />}
                        {b.source === "direct" && b.paymentStatus === "not_required" && <Pill tone="neutral">Free</Pill>}
                      </span>
                    </td>
                    <td className={a.num}>
                      {b.amountPaidCents ? formatMoney(b.amountPaidCents - b.amountRefundedCents) : <span className={a.dash}>–</span>}
                      {b.amountRefundedCents > 0 && <span className={a.cellSub}>{formatMoney(b.amountRefundedCents)} refunded</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(f.page > 1 || hasMore) && (
          <div className={a.pager}>
            <span>
              {(f.page - 1) * PAGE_SIZE + 1}–{(f.page - 1) * PAGE_SIZE + rows.length}
            </span>
            <span className={a.row}>
              {f.page > 1 && (
                <Link className={`${a.btn} ${a.btnSm}`} href={`/admin/bookings${filterQuery(f, { page: f.page - 1 })}`}>
                  <Icon name="left" size={14} /> Newer
                </Link>
              )}
              {hasMore && (
                <Link className={`${a.btn} ${a.btnSm}`} href={`/admin/bookings${filterQuery(f, { page: f.page + 1 })}`}>
                  More <Icon name="right" size={14} />
                </Link>
              )}
            </span>
          </div>
        )}
      </Panel>
    </div>
  );
}
