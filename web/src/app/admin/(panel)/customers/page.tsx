import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CUSTOMER_PAGE, customerQuery, listCustomers, parseCustomerFilters } from "@/lib/admin/customers";
import { fmt } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import { SOURCE_LABEL } from "@/components/admin/format";
import type { BookingSource } from "@/lib/db/schema";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Customers" };

const SORTS = [
  { v: "recent", label: "Recent" },
  { v: "spent", label: "Top spenders" },
  { v: "sessions", label: "Most sessions" },
  { v: "name", label: "A–Z" },
] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const f = parseCustomerFilters(await searchParams);
  const { rows, hasMore, total } = await listCustomers(f);
  const now = new Date();

  return (
    <div className={a.page}>
      <PageHeader
        title="Customers"
        sub={`${total} people who have booked, bought a gift card or been added by you.`}
        actions={
          <a className={a.btn} href={`/api/admin/export/customers.csv${customerQuery(f, { page: 1 })}`} download>
            <Icon name="download" size={16} /> Export CSV
          </a>
        }
      />

      <nav className={a.tabs} aria-label="Sort customers">
        {SORTS.map((s) => (
          <Link key={s.v} href={`/admin/customers${customerQuery(f, { sort: s.v, page: 1 })}`} className={`${a.tab} ${f.sort === s.v ? a.tabActive : ""}`} aria-current={f.sort === s.v ? "page" : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>

      <form className={a.filters} method="get" role="search" aria-label="Search customers">
        {f.sort !== "recent" && <input type="hidden" name="sort" value={f.sort} />}
        <div className={`${a.field} ${a.grow}`}>
          <label htmlFor="cq">Search</label>
          <input id="cq" name="q" type="search" className={a.input} defaultValue={f.q} placeholder="Name, email or phone" />
        </div>
        <label className={a.check} style={{ alignSelf: "center", paddingTop: 20 }}>
          <input type="checkbox" name="optin" value="1" defaultChecked={f.optIn} />
          <span>Only people who said yes to news</span>
        </label>
        <button className={`${a.btn} ${a.btnPrimary}`} type="submit">
          Apply
        </button>
      </form>

      <Panel>
        {rows.length === 0 ? (
          <Empty>{f.q || f.optIn ? "No customers match." : "No customers yet."}</Empty>
        ) : (
          <div className={a.tableWrap}>
            <table className={`${a.table} ${a.tableStack}`}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th className={a.num}>Sessions</th>
                  <th className={a.num}>Spent</th>
                  <th>Last / next</th>
                  <th>Came from</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className={a.rowLink}>
                        {c.name}
                      </Link>
                      <span className={`${a.cellSub} ${a.hideSm}`}>
                        {c.sessions > 1 && <Pill tone="accent">Returning</Pill>} {c.marketingOptIn && <Pill tone="info">News opt-in</Pill>}
                      </span>
                    </td>
                    <td>
                      {c.hasEmail ? c.email : <span className={a.muted}>No email</span>}
                      {c.phone && <span className={a.cellSub}>{c.phone}</span>}
                    </td>
                    <td className={a.num} data-label="Sessions">
                      {c.sessions}
                    </td>
                    <td className={a.num} data-label="Spent">
                      {c.spent ? formatMoney(c.spent) : <span className={a.dash}>–</span>}
                    </td>
                    <td className={a.nowrap}>
                      {c.nextAt ? (
                        <>
                          Next {fmt(c.nextAt, "MMM d")}
                          {c.lastAt && <span className={a.cellSub}>Last {fmt(c.lastAt, c.lastAt.getFullYear() === now.getFullYear() ? "MMM d" : "MMM yyyy")}</span>}
                        </>
                      ) : c.lastAt ? (
                        <>Last {fmt(c.lastAt, c.lastAt.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy")}</>
                      ) : (
                        <span className={a.dash}>–</span>
                      )}
                    </td>
                    <td className={a.hideSm}>{c.sources.map((s) => SOURCE_LABEL[s as BookingSource] ?? s).join(", ") || <span className={a.dash}>–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(f.page > 1 || hasMore) && (
          <div className={a.pager}>
            <span>
              {(f.page - 1) * CUSTOMER_PAGE + 1}–{(f.page - 1) * CUSTOMER_PAGE + rows.length} of {total}
            </span>
            <span className={a.row}>
              {f.page > 1 && (
                <Link className={`${a.btn} ${a.btnSm}`} href={`/admin/customers${customerQuery(f, { page: f.page - 1 })}`}>
                  <Icon name="left" size={14} /> Back
                </Link>
              )}
              {hasMore && (
                <Link className={`${a.btn} ${a.btnSm}`} href={`/admin/customers${customerQuery(f, { page: f.page + 1 })}`}>
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
