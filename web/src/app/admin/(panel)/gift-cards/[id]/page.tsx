import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bookings, giftCardTransactions, giftCards } from "@/lib/db/schema";
import { fmt } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ActionForm";
import { CopyButton } from "@/components/admin/CopyButton";
import { Pill } from "@/components/admin/Pill";
import { GIFT_STATUS } from "@/components/admin/format";
import { adjustGiftCardAction, resendGiftCardAction, voidGiftCardAction } from "../actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Gift card" };

export default async function GiftCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const [g] = await db.select().from(giftCards).where(eq(giftCards.id, id)).limit(1);
  if (!g) notFound();
  const tx = await db
    .select({ t: giftCardTransactions, code: bookings.code })
    .from(giftCardTransactions)
    .leftJoin(bookings, eq(bookings.id, giftCardTransactions.bookingId))
    .where(eq(giftCardTransactions.giftCardId, g.id))
    .orderBy(desc(giftCardTransactions.createdAt));
  const st = GIFT_STATUS[g.status];

  return (
    <div className={`${a.page} ${a.pageNarrow}`}>
      <PageHeader
        back={{ href: "/admin/gift-cards", label: "Gift cards" }}
        title={<span className={a.code} style={{ fontSize: "inherit", fontFamily: "var(--display)" }}>{g.code}</span>}
        sub={`${formatMoney(g.balanceCents)} left of ${formatMoney(g.initialCents)}`}
        actions={
          <>
            <Pill tone={st.tone}>{st.label}</Pill>
            <CopyButton text={g.code} label="Copy code" />
          </>
        }
      />
      {sp.issued === "1" && (
        <p className={`${a.notice} ${a.noticeOk}`} style={{ marginBottom: 16 }} role="status">
          Gift card created{g.deliveredAt ? " and emailed" : ""}. Guests enter the code at checkout.
        </p>
      )}

      <div className={a.split}>
        <div className={a.stack}>
          <Panel title="Details">
            <div className={a.panelBody}>
              <dl className={a.dl}>
                <dt>From</dt>
                <dd>
                  {g.purchaserName}
                  <span className={a.cellSub}>{g.purchaserEmail}</span>
                </dd>
                <dt>To</dt>
                <dd>
                  {g.recipientName ?? <span className={a.muted}>Not named</span>}
                  {g.recipientEmail && <span className={a.cellSub}>{g.recipientEmail}</span>}
                </dd>
                {g.message && (
                  <>
                    <dt>Message</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>“{g.message}”</dd>
                  </>
                )}
                <dt>Created</dt>
                <dd>
                  {fmt(g.createdAt, "MMM d, yyyy")} · {g.issuedByAdmin ? "given by you" : "bought on the website"}
                </dd>
                <dt>Delivery</dt>
                <dd>
                  {g.deliveredAt
                    ? `Emailed ${fmt(g.deliveredAt, "MMM d, h:mmaaa")}`
                    : g.deliverAt
                      ? `Scheduled for ${fmt(g.deliverAt, "MMM d")}`
                      : "Not emailed"}
                </dd>
              </dl>
            </div>
          </Panel>

          <Panel title="History" count={tx.length || undefined}>
            {tx.length === 0 ? (
              <Empty>No activity.</Empty>
            ) : (
              <ul className={a.list}>
                {tx.map(({ t, code }) => (
                  <li key={t.id} className={a.listRow}>
                    <div className={a.listMain}>
                      <div>{t.note || (t.amountCents < 0 ? "Spent" : "Loaded")}</div>
                      <div className={a.listMeta}>
                        {fmt(t.createdAt, "MMM d, yyyy h:mmaaa")}
                        {code && t.bookingId && (
                          <>
                            {" · "}
                            <Link href={`/admin/bookings/${t.bookingId}`} className={a.code}>
                              {code}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`${a.num} ${t.amountCents < 0 ? a.down : a.up}`}>
                      {t.amountCents > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(t.amountCents))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className={a.stack}>
          {g.status === "active" || g.status === "depleted" ? (
            <Panel title="Actions">
              {g.status === "active" && (
                <details className={a.disclosure}>
                  <summary>Email it again</summary>
                  <div className={a.disclosureBody}>
                    <ActionForm action={resendGiftCardAction}>
                      <input type="hidden" name="id" value={g.id} />
                      <p className={a.hint}>Sends the gift card to {g.recipientEmail ?? g.purchaserEmail}.</p>
                      <div className={a.formFoot}>
                        <SubmitButton className={a.btn} pendingText="Sending…">
                          Send
                        </SubmitButton>
                      </div>
                    </ActionForm>
                  </div>
                </details>
              )}
              <details className={a.disclosure}>
                <summary>Change balance</summary>
                <div className={a.disclosureBody}>
                  <ActionForm action={adjustGiftCardAction} resetOnSuccess>
                    <input type="hidden" name="id" value={g.id} />
                    <div className={a.formRow}>
                      <div className={a.field}>
                        <label htmlFor="adj-dir">Change</label>
                        <select id="adj-dir" name="direction" className={a.select} defaultValue="add">
                          <option value="add">Add</option>
                          <option value="remove">Take off</option>
                        </select>
                      </div>
                      <div className={a.field}>
                        <label htmlFor="adj-amt">Amount</label>
                        <input id="adj-amt" name="amount" inputMode="decimal" className={a.input} required />
                      </div>
                    </div>
                    <div className={a.field}>
                      <label htmlFor="adj-note">Why</label>
                      <input id="adj-note" name="note" className={a.input} placeholder="e.g. Used in person for a session" required />
                    </div>
                    <div className={a.formFoot}>
                      <SubmitButton className={a.btn} pendingText="Saving…">
                        Update balance
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </details>
              {g.status === "active" && (
                <details className={a.disclosure}>
                  <summary>Void card</summary>
                  <div className={a.disclosureBody}>
                    <ActionForm action={voidGiftCardAction}>
                      <input type="hidden" name="id" value={g.id} />
                      <p className={a.hint}>Sets the balance to $0 so it can’t be used. Refund the buyer in Stripe separately if needed.</p>
                      <div className={a.field}>
                        <label htmlFor="void-why">Reason</label>
                        <input id="void-why" name="reason" className={a.input} />
                      </div>
                      <div className={a.formFoot}>
                        <ConfirmSubmit confirmLabel="Void it" question="This can’t be undone.">
                          Void card…
                        </ConfirmSubmit>
                      </div>
                    </ActionForm>
                  </div>
                </details>
              )}
            </Panel>
          ) : (
            <Panel title="Actions">
              <Empty>{g.status === "void" ? "This card is void." : "Waiting for payment. It becomes active when the buyer pays."}</Empty>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
