import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCustomerDetail } from "@/lib/admin/customers";
import { fmt, fmtTimeRange } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { BookingStatusPill, ExpName, Pill } from "@/components/admin/Pill";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Icon } from "@/components/admin/Icon";
import { SOURCE_LABEL, plural, telHref } from "@/components/admin/format";
import { updateCustomerAction } from "../actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await getCustomerDetail(id);
  if (!r) notFound();
  const { customer: c } = r;
  const hasEmail = !c.email.endsWith("@rawplanet.invalid");
  const live = r.bookings.filter((b) => ["confirmed", "completed", "no_show"].includes(b.status));
  const spent = r.bookings.filter((b) => b.status !== "pending_payment" && b.status !== "expired").reduce((n, b) => n + b.paid - b.refunded, 0);
  const now = new Date();

  return (
    <div className={a.page}>
      <PageHeader
        back={{ href: "/admin/customers", label: "Customers" }}
        title={c.name}
        sub={`${plural(live.length, "session")} · ${formatMoney(spent)} spent · customer since ${fmt(c.createdAt, "MMM yyyy")}`}
        actions={
          <Link
            className={`${a.btn} ${a.btnPrimary}`}
            href={`/admin/bookings/new?${new URLSearchParams({ source: "phone" })}`}
          >
            <Icon name="plus" size={16} /> Book again
          </Link>
        }
      />

      <div className={a.split}>
        <div className={a.stack}>
          <Panel title="Bookings" count={r.bookings.length || undefined}>
            {r.bookings.length === 0 ? (
              <Empty>No bookings.</Empty>
            ) : (
              <div className={a.tableWrap}>
                <table className={`${a.table} ${a.tableStack}`}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Experience</th>
                      <th>Status</th>
                      <th className={a.num}>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.bookings.map((b) => (
                      <tr key={b.id}>
                        <td className={a.nowrap}>
                          <Link href={`/admin/bookings/${b.id}`} className={a.rowLink}>
                            {fmt(b.startAt, b.startAt.getFullYear() === now.getFullYear() ? "EEE MMM d" : "MMM d, yyyy")}
                          </Link>
                          <span className={a.cellSub}>
                            {fmtTimeRange(b.startAt, b.endAt)} · {SOURCE_LABEL[b.source]}
                          </span>
                        </td>
                        <td>
                          <ExpName theme={b.theme} name={b.experience} />
                          <span className={a.cellSub}>
                            {plural(b.guests, "guest")}
                            {b.occasion ? ` · ${b.occasion}` : ""}
                          </span>
                        </td>
                        <td>
                          <BookingStatusPill status={b.status} />
                        </td>
                        <td className={a.num}>{b.paid ? formatMoney(b.paid - b.refunded) : <span className={a.dash}>–</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {r.giftCards.length > 0 && (
            <Panel title="Gift cards" count={r.giftCards.length}>
              <ul className={a.list}>
                {r.giftCards.map((g) => (
                  <li key={g.id} className={a.listRow}>
                    <div className={a.listMain}>
                      <Link href={`/admin/gift-cards/${g.id}`} className={`${a.rowLink} ${a.code}`}>
                        {g.code}
                      </Link>
                      <div className={a.listMeta}>
                        {g.purchaserEmail === c.email ? `Bought ${fmt(g.createdAt, "MMM d, yyyy")}${g.recipientName ? ` for ${g.recipientName}` : ""}` : `Received from ${g.purchaserName}`}
                      </div>
                    </div>
                    <span className={a.num}>
                      {formatMoney(g.balanceCents)} <span className={a.muted}>of {formatMoney(g.initialCents)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {(r.inquiries.length > 0 || r.rsvps.length > 0) && (
            <Panel title="Other contact">
              <ul className={a.list}>
                {r.inquiries.map((i) => (
                  <li key={i.id}>
                    <Link href={`/admin/inquiries?open=${i.id}`} className={a.rowLink}>
                      Inquiry · {i.kind.replace("_", " ")}
                    </Link>{" "}
                    <Pill tone={i.status === "new" ? "accent" : "neutral"}>{i.status}</Pill>
                    <div className={a.listMeta}>
                      {fmt(i.createdAt, "MMM d, yyyy")} · {i.message.slice(0, 140)}
                    </div>
                  </li>
                ))}
                {r.rsvps.map((v) => (
                  <li key={v.id}>
                    <Link href={`/admin/events/${v.eventId}`} className={a.rowLink}>
                      RSVP · {v.title}
                    </Link>
                    <div className={a.listMeta}>
                      {fmt(v.startAt, "MMM d, yyyy")} · {plural(v.guests, "person", "people")} · {v.status}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className={a.stack}>
          <Panel title="Contact">
            <div className={a.panelBody}>
              <dl className={a.dl} style={{ gridTemplateColumns: "70px minmax(0,1fr)" }}>
                <dt>Email</dt>
                <dd>{hasEmail ? <a href={`mailto:${c.email}`}>{c.email}</a> : <span className={a.muted}>None</span>}</dd>
                <dt>Phone</dt>
                <dd>{c.phone ? <a href={`tel:${telHref(c.phone)}`}>{c.phone}</a> : <span className={a.muted}>None</span>}</dd>
              </dl>
              <div className={a.row} style={{ marginTop: 12 }}>
                {c.phone && (
                  <a className={`${a.btn} ${a.btnSm}`} href={`sms:${telHref(c.phone)}`}>
                    <Icon name="sms" size={15} /> Text
                  </a>
                )}
                {hasEmail && (
                  <a className={`${a.btn} ${a.btnSm}`} href={`mailto:${c.email}`}>
                    <Icon name="mail" size={15} /> Email
                  </a>
                )}
              </div>
            </div>
          </Panel>
          <Panel title="Details">
            <div className={a.panelBody}>
              <ActionForm action={updateCustomerAction}>
                <input type="hidden" name="id" value={c.id} />
                <div className={a.field}>
                  <label htmlFor="c-name">Name</label>
                  <input id="c-name" name="name" className={a.input} defaultValue={c.name} required />
                </div>
                <div className={a.field}>
                  <label htmlFor="c-phone">Phone</label>
                  <input id="c-phone" name="phone" type="tel" className={a.input} defaultValue={c.phone ?? ""} />
                </div>
                <div className={a.field}>
                  <label htmlFor="c-lang">Emails in</label>
                  <select id="c-lang" name="language" className={a.select} defaultValue={c.language}>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>
                <div className={a.field}>
                  <label htmlFor="c-notes">Notes (only you see them)</label>
                  <textarea id="c-notes" name="notes" className={a.textarea} defaultValue={c.notes} placeholder="Likes deep house, brings own headphones…" />
                </div>
                <label className={a.check}>
                  <input type="checkbox" name="marketingOptIn" defaultChecked={c.marketingOptIn} />
                  <span>Happy to get news and offers</span>
                </label>
                <div className={a.formFoot}>
                  <SubmitButton pendingText="Saving…">Save</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
