import Link from "next/link";
import { and, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { giftCards } from "@/lib/db/schema";
import { fmt, fromLocal, todayKey } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { GiftTabs } from "@/components/admin/GiftTabs";
import { Pill } from "@/components/admin/Pill";
import { issueGiftCardAction } from "./actions";
import { GIFT_STATUS } from "@/components/admin/format";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Gift cards" };


const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80);
  const show = one(sp.show) === "all" ? "all" : "open";
  const db = await getDb();
  const where: SQL[] = [ne(giftCards.status, "pending_payment")];
  if (show === "open") where.push(eq(giftCards.status, "active"));
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(giftCards.code, like), ilike(giftCards.purchaserName, like), ilike(giftCards.purchaserEmail, like), ilike(giftCards.recipientName, like), ilike(giftCards.recipientEmail, like))!);
  }
  const yearStart = fromLocal(`${todayKey().slice(0, 4)}-01-01`);
  const [rows, [totals]] = await Promise.all([
    db.select().from(giftCards).where(and(...where)).orderBy(desc(giftCards.createdAt)).limit(200),
    db
      .select({
        outstanding: sql<number>`coalesce(sum(${giftCards.balanceCents}) filter (where ${giftCards.status} = 'active'), 0)::int`,
        open: sql<number>`count(*) filter (where ${giftCards.status} = 'active')::int`,
        soldYear: sql<number>`coalesce(sum(${giftCards.initialCents}) filter (where not ${giftCards.issuedByAdmin} and ${giftCards.status} <> 'pending_payment' and ${giftCards.createdAt} >= ${yearStart}), 0)::int`,
        countYear: sql<number>`count(*) filter (where not ${giftCards.issuedByAdmin} and ${giftCards.status} <> 'pending_payment' and ${giftCards.createdAt} >= ${yearStart})::int`,
      })
      .from(giftCards),
  ]);

  return (
    <div className={a.page}>
      <PageHeader title="Gift cards & promos" sub="Gift cards guests bought, cards you gave away, and discount codes." />
      <GiftTabs current="cards" />

      <div className={a.kpis} style={{ ["--kpi-cols" as string]: 3, marginBottom: 16 }}>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Unspent balance</div>
          <div className={a.kpiValue}>{formatMoney(Number(totals?.outstanding ?? 0))}</div>
          <div className={a.kpiNote}>Owed in future sessions</div>
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Active cards</div>
          <div className={a.kpiValue}>{Number(totals?.open ?? 0)}</div>
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Sold this year</div>
          <div className={a.kpiValue}>{formatMoney(Number(totals?.soldYear ?? 0))}</div>
          <div className={a.kpiNote}>{Number(totals?.countYear ?? 0)} cards</div>
        </div>
      </div>

      <div className={a.split}>
        <div>
          <form className={a.filters} method="get" role="search" aria-label="Find gift cards">
            <div className={`${a.field} ${a.grow}`}>
              <label htmlFor="gq">Search</label>
              <input id="gq" name="q" type="search" className={a.input} defaultValue={q} placeholder="Code, buyer or recipient" />
            </div>
            <div className={a.field}>
              <label htmlFor="gshow">Show</label>
              <select id="gshow" name="show" className={a.select} defaultValue={show}>
                <option value="open">With balance</option>
                <option value="all">All cards</option>
              </select>
            </div>
            <button className={`${a.btn} ${a.btnPrimary}`} type="submit">
              Apply
            </button>
          </form>
          <Panel>
            {rows.length === 0 ? (
              <Empty>{q ? "No cards match." : show === "open" ? "No gift cards with a balance." : "No gift cards yet."}</Empty>
            ) : (
              <div className={a.tableWrap}>
                <table className={`${a.table} ${a.tableStack}`}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>From → to</th>
                      <th className={a.num}>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <Link href={`/admin/gift-cards/${g.id}`} className={`${a.rowLink} ${a.code}`}>
                            {g.code}
                          </Link>
                          <span className={a.cellSub}>{fmt(g.createdAt, "MMM d, yyyy")}</span>
                        </td>
                        <td>
                          {g.purchaserName}
                          {g.recipientName ? ` → ${g.recipientName}` : ""}
                          {g.issuedByAdmin && <span className={a.cellSub}>Given by you</span>}
                        </td>
                        <td className={a.num}>
                          {formatMoney(g.balanceCents)}
                          <span className={a.cellSub}>of {formatMoney(g.initialCents)}</span>
                        </td>
                        <td>
                          <Pill tone={GIFT_STATUS[g.status].tone}>{GIFT_STATUS[g.status].label}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Give a gift card">
          <div className={a.panelBody}>
            <ActionForm action={issueGiftCardAction}>
              <p className={a.hint}>For prizes, apologies, collaborations. It doesn’t count as revenue.</p>
              <div className={a.field}>
                <label htmlFor="gc-amt">Amount</label>
                <input id="gc-amt" name="amount" inputMode="decimal" className={a.input} placeholder="$150" required />
              </div>
              <div className={a.field}>
                <label htmlFor="gc-rn">Recipient name</label>
                <input id="gc-rn" name="recipientName" className={a.input} />
              </div>
              <div className={a.field}>
                <label htmlFor="gc-re">Recipient email</label>
                <input id="gc-re" name="recipientEmail" type="email" className={a.input} />
              </div>
              <div className={a.field}>
                <label htmlFor="gc-from">From</label>
                <input id="gc-from" name="purchaserName" className={a.input} defaultValue="Alex at Raw Planet" />
              </div>
              <div className={a.field}>
                <label htmlFor="gc-msg">Message</label>
                <textarea id="gc-msg" name="message" className={a.textarea} rows={3} />
              </div>
              <label className={a.check}>
                <input type="checkbox" name="sendEmail" defaultChecked />
                <span>Email it to the recipient now</span>
              </label>
              <div className={a.formFoot}>
                <SubmitButton pendingText="Creating…">Create gift card</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </Panel>
      </div>
    </div>
  );
}
