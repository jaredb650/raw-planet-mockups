import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getBookingDetail } from "@/lib/admin/bookings";
import { refundForCancellation } from "@/lib/booking/pricing";
import { canCheckIn } from "@/lib/booking/service";
import { signingState } from "@/lib/waiver";
import { waiverUrlFor } from "@/lib/waiver-token";
import { manageUrl } from "@/lib/email/notify";
import { fmt, fmtDateLong, fmtDuration, fmtTimeRange, localDateKey } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { BookingStatusPill, DeliverablePill, ExpName, PaymentPill, Pill } from "@/components/admin/Pill";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { CancelForm, RescheduleForm } from "@/components/admin/BookingForms";
import { CheckInButton } from "@/components/admin/CheckInButton";
import { CopyButton } from "@/components/admin/CopyButton";
import { Icon } from "@/components/admin/Icon";
import { SOURCE_LABEL, plural, telHref } from "@/components/admin/format";
import {
  cancelAction,
  deliverableAction,
  noteAction,
  refundAction,
  rescheduleAction,
  resendConfirmationAction,
  setStatusAction,
} from "../actions";
import a from "@/components/admin/admin.module.css";
import d from "@/components/admin/detail.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getBookingDetail(id).catch(() => null);
  return { title: r ? `${r.booking.contactName} · ${r.booking.code}` : "Booking" };
}

const ACTOR: Record<string, string> = { admin: "You", customer: "Guest", system: "System" };

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await getBookingDetail(id);
  if (!r) notFound();
  const { booking: b, experience: x } = r;
  const now = new Date();
  const hasEmail = !b.contactEmail.endsWith("@rawplanet.invalid");
  const ended = b.endAt <= now;
  const remaining = Math.max(0, b.amountPaidCents - b.amountRefundedCents);
  const policy = refundForCancellation({
    startAt: b.startAt,
    cancellationHours: x.cancellationHours,
    amountPaidCents: b.amountPaidCents,
    amountRefundedCents: b.amountRefundedCents,
    giftCardCents: b.giftCardCents,
  });
  const live = b.status === "confirmed";
  const showDeliverable = x.theme === "production" || b.deliverableStatus !== "none";
  const manage = manageUrl(b);
  const stripeUrl = b.stripePaymentIntentId
    ? `https://dashboard.stripe.com/${b.stripePaymentIntentId.startsWith("pi_test") || process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test/" : ""}payments/${b.stripePaymentIntentId}`
    : null;

  return (
    <div className={a.page}>
      <PageHeader
        back={{ href: "/admin/bookings", label: "Bookings" }}
        title={b.contactName}
        sub={
          <>
            <span className={a.code}>{b.code}</span> · {x.shortName} · {fmt(b.startAt, "EEE MMM d")}, {fmtTimeRange(b.startAt, b.endAt)}
          </>
        }
        actions={
          <span className={a.row} style={{ gap: 6 }}>
            <BookingStatusPill status={b.status} />
            <PaymentPill status={b.paymentStatus} />
            {b.checkedInAt && b.status !== "no_show" && <Pill tone="success">Checked in</Pill>}
            <Link className={`${a.btn} ${a.btnSm}`} href={`/admin/bookings/new?rebook=${b.id}`}>
              <Icon name="plus" size={15} /> Book again
            </Link>
          </span>
        }
      />

      {sp.created === "1" && (
        <p className={`${a.notice} ${a.noticeOk}`} style={{ marginBottom: 16 }} role="status">
          Booking added{b.confirmationSentAt ? " and the confirmation email sent" : ""}. It now blocks this time on the website.
        </p>
      )}
      {b.status === "pending_payment" && (
        <p className={`${a.notice} ${a.noticeWarn}`} style={{ marginBottom: 16 }}>
          The guest is in checkout. The slot is held until {b.holdExpiresAt ? fmt(b.holdExpiresAt, "h:mmaaa") : "the hold lapses"}; it confirms by itself when they pay.
        </p>
      )}

      <div className={a.split}>
        <div className={a.stack}>
          <Panel title="Session">
            <div className={a.panelBody}>
              <dl className={a.dl}>
                <dt>When</dt>
                <dd>
                  <strong>{fmtDateLong(b.startAt)}</strong>, {fmtTimeRange(b.startAt, b.endAt)}
                  <span className={a.cellSub}>
                    {fmtDuration(b.durationMinutes)}
                    {b.rescheduleCount ? ` · moved ${plural(b.rescheduleCount, "time")} by the guest` : ""}
                  </span>
                </dd>
                <dt>Experience</dt>
                <dd>
                  <ExpName theme={x.theme} name={x.name} />
                </dd>
                <dt>Guests</dt>
                <dd>{b.guests}</dd>
                <dt>Booked via</dt>
                <dd>
                  {SOURCE_LABEL[b.source] ?? b.source}
                  {b.externalRef && (
                    <>
                      {" "}
                      · <span className={a.mono}>{b.externalRef}</span>
                    </>
                  )}
                  <span className={a.cellSub}>on {fmt(b.createdAt, "MMM d, yyyy 'at' h:mmaaa")}</span>
                </dd>
                {b.occasion && (
                  <>
                    <dt>Occasion</dt>
                    <dd>
                      <Pill tone="accent">{b.occasion}</Pill>
                    </dd>
                  </>
                )}
                {b.isGift && (
                  <>
                    <dt>Gift</dt>
                    <dd>
                      For {b.giftRecipientName ?? "someone"}
                      {b.giftRecipientEmail ? ` (${b.giftRecipientEmail})` : ""}
                      {b.giftMessage && <span className={a.cellSub}>“{b.giftMessage}”</span>}
                    </dd>
                  </>
                )}
                {b.customerNotes && (
                  <>
                    <dt>Guest’s note</dt>
                    <dd className={d.quote}>{b.customerNotes}</dd>
                  </>
                )}
                {b.language !== "en" && (
                  <>
                    <dt>Language</dt>
                    <dd>{b.language === "es" ? "Spanish" : b.language}</dd>
                  </>
                )}
                {r.addons.length > 0 && (
                  <>
                    <dt>Add-ons</dt>
                    <dd>{r.addons.map((ad) => `${ad.name}${ad.quantity > 1 ? ` ×${ad.quantity}` : ""}`).join(", ")}</dd>
                  </>
                )}
                {showDeliverable && (
                  <>
                    <dt>Track</dt>
                    <dd>
                      <DeliverablePill status={b.deliverableStatus} />
                      {b.deliverableUrl && (
                        <a className={`${a.ext} ${a.small}`} href={b.deliverableUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>
                          Download link
                        </a>
                      )}
                    </dd>
                  </>
                )}
                {b.cancelledAt && (
                  <>
                    <dt>Cancelled</dt>
                    <dd>
                      {fmt(b.cancelledAt, "MMM d 'at' h:mmaaa")} by {b.cancelledBy === "admin" ? "you" : b.cancelledBy ?? "system"}
                      {b.cancelReason && <span className={a.cellSub}>{b.cancelReason}</span>}
                    </dd>
                  </>
                )}
                {r.rescheduledFrom && (
                  <>
                    <dt>Replaces</dt>
                    <dd>
                      <Link href={`/admin/bookings/${r.rescheduledFrom.id}`} className={a.code}>
                        {r.rescheduledFrom.code}
                      </Link>
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </Panel>

          <Panel title="Guest" action={r.customer ? <Link className={a.panelLink} href={`/admin/customers/${r.customer.id}`}>Customer profile</Link> : undefined}>
            <div className={a.panelBody}>
              <dl className={a.dl}>
                <dt>Name</dt>
                <dd>{b.contactName}</dd>
                <dt>Email</dt>
                <dd>{hasEmail ? <a href={`mailto:${b.contactEmail}`}>{b.contactEmail}</a> : <span className={a.muted}>None on file</span>}</dd>
                <dt>Phone</dt>
                <dd>{b.contactPhone ? <a href={`tel:${telHref(b.contactPhone)}`}>{b.contactPhone}</a> : <span className={a.muted}>None on file</span>}</dd>
                {r.customerBookings > 1 && (
                  <>
                    <dt>History</dt>
                    <dd>{plural(r.customerBookings, "session")} with you · returning guest</dd>
                  </>
                )}
              </dl>
              <div className={a.row} style={{ marginTop: 14 }}>
                {b.contactPhone && (
                  <>
                    <a className={`${a.btn} ${a.btnSm}`} href={`tel:${telHref(b.contactPhone)}`}>
                      <Icon name="phone" size={15} /> Call
                    </a>
                    <a className={`${a.btn} ${a.btnSm}`} href={`sms:${telHref(b.contactPhone)}`}>
                      <Icon name="sms" size={15} /> Text
                    </a>
                  </>
                )}
                {hasEmail && (
                  <a className={`${a.btn} ${a.btnSm}`} href={`mailto:${b.contactEmail}?subject=${encodeURIComponent(`Your Raw Planet session (${b.code})`)}`}>
                    <Icon name="mail" size={15} /> Email
                  </a>
                )}
                <CopyButton text={manage} label="Copy guest’s manage link" />
              </div>
            </div>
          </Panel>

          {(x.waiverRequired || r.waivers.length > 0) && (
            <Panel
              id="waivers"
              title="Waivers"
              count={`${r.waivers.length} of ${b.guests} signed`}
              action={signingState(b, r.waivers.length) !== "closed" ? <CopyButton text={waiverUrlFor(b)} label="Copy signing link" /> : undefined}
            >
              {(b.source === "airbnb" || b.source === "viator") && (
                <p className={`${a.panelBody} ${a.small} ${a.muted}`}>
                  {SOURCE_LABEL[b.source]} guests don’t get our emails. Copy the link and send it in the {SOURCE_LABEL[b.source]} chat.
                </p>
              )}
              {r.waivers.length === 0 ? (
                <Empty>Nobody has signed yet.</Empty>
              ) : (
                <ul className={a.list}>
                  {r.waivers.map((w) => (
                    <li key={w.id} className={a.listRow}>
                      <div className={a.listMain}>
                        <strong>{w.signerName}</strong>
                        <div className={a.listMeta}>
                          {w.minorName ? `For ${w.minorName} (minor) · ` : ""}
                          {fmt(w.signedAt, "MMM d, h:mmaaa")}
                        </div>
                        <details>
                          <summary className={a.small}>Read what they signed</summary>
                          <p className={`${a.small} ${a.muted}`}>
                            Version {w.waiverVersion} · IP {w.ip ?? "unknown"} · {w.userAgent ?? "unknown device"}
                          </p>
                          <p className={a.small} style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                            {w.waiverText}
                          </p>
                        </details>
                      </div>
                      <Pill tone={w.recordingConsent ? "success" : "warning"}>{w.recordingConsent ? "Recording OK" : "No recording"}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel title="Payment" action={stripeUrl ? <a className={a.panelLink} href={stripeUrl} target="_blank" rel="noreferrer">Open in Stripe</a> : undefined}>
            <div className={a.panelBody}>
              <table className={d.money}>
                <tbody>
                  {b.subtotalCents > 0 && (
                    <tr>
                      <td>
                        Session
                        {b.priceAdjustCents !== 0 && (
                          <span className={a.cellSub}>
                            Includes {b.priceAdjustCents > 0 ? "+" : "−"}{formatMoney(Math.abs(b.priceAdjustCents))} smart pricing{b.priceRuleName ? ` (${b.priceRuleName})` : ""}
                          </span>
                        )}
                      </td>
                      <td className={a.num}>{formatMoney(b.subtotalCents)}</td>
                    </tr>
                  )}
                  {b.addonsCents > 0 && (
                    <tr>
                      <td>Add-ons</td>
                      <td className={a.num}>{formatMoney(b.addonsCents)}</td>
                    </tr>
                  )}
                  {b.discountCents > 0 && (
                    <tr>
                      <td>Discount{r.promo ? ` (${r.promo.code})` : ""}</td>
                      <td className={a.num}>−{formatMoney(b.discountCents)}</td>
                    </tr>
                  )}
                  {b.giftCardCents > 0 && (
                    <tr>
                      <td>
                        Gift card{" "}
                        {r.giftCard && (
                          <Link href={`/admin/gift-cards/${r.giftCard.id}`} className={a.code}>
                            {r.giftCard.code}
                          </Link>
                        )}
                      </td>
                      <td className={a.num}>−{formatMoney(b.giftCardCents)}</td>
                    </tr>
                  )}
                  <tr className={d.total}>
                    <td>Total</td>
                    <td className={a.num}>{formatMoney(b.totalCents)}</td>
                  </tr>
                  <tr>
                    <td>Paid by card</td>
                    <td className={a.num}>{formatMoney(b.amountPaidCents)}</td>
                  </tr>
                  {b.amountRefundedCents > 0 && (
                    <tr>
                      <td>Refunded</td>
                      <td className={a.num}>−{formatMoney(b.amountRefundedCents)}</td>
                    </tr>
                  )}
                  <tr className={d.total}>
                    <td>You keep</td>
                    <td className={a.num}>{formatMoney(remaining)}</td>
                  </tr>
                </tbody>
              </table>
              {(b.source === "airbnb" || b.source === "viator") && b.amountPaidCents === 0 && (
                <p className={`${a.small} ${a.muted}`} style={{ marginTop: 10 }}>
                  Paid through {SOURCE_LABEL[b.source]}; payouts are tracked there.
                </p>
              )}
              {r.refunds.length > 0 && (
                <ul className={d.refunds}>
                  {r.refunds.map((rf) => (
                    <li key={rf.id}>
                      {fmt(rf.createdAt, "MMM d")}: {formatMoney(rf.amountCents)} to card
                      {rf.giftCardCents ? ` + ${formatMoney(rf.giftCardCents)} to gift card` : ""}
                      {rf.reason ? ` · ${rf.reason}` : ""}
                      {rf.stripeRefundId ? "" : <span className={a.muted}> (not sent to Stripe)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel title="Timeline" count={r.events.length || undefined}>
            <div className={a.panelBody} style={{ paddingBottom: 6 }}>
              <ActionForm action={noteAction} resetOnSuccess className={d.noteForm}>
                <input type="hidden" name="id" value={b.id} />
                <label htmlFor="note" className="sr-only">
                  Add a private note
                </label>
                <textarea id="note" name="note" className={a.textarea} rows={2} placeholder="Add a private note (only you see it)" style={{ minHeight: 64 }} required />
                <div>
                  <SubmitButton className={`${a.btn} ${a.btnSm}`} pendingText="Saving…">
                    Add note
                  </SubmitButton>
                </div>
              </ActionForm>
            </div>
            {r.events.length === 0 ? (
              <Empty>No activity yet.</Empty>
            ) : (
              <ol className={d.timeline}>
                {r.events.map((e) => (
                  <li key={e.id} className={e.type === "note" ? d.isNote : e.type.includes("error") ? d.isError : ""}>
                    <div className={d.evHead}>
                      <span className={d.evType}>{e.type.charAt(0).toUpperCase() + e.type.slice(1).replace(/_/g, " ")}</span>
                      <span className={d.evMeta}>
                        {ACTOR[e.actor] ?? e.actor} · {fmt(e.createdAt, "MMM d, h:mmaaa")}
                        {e.public && " · guest can see"}
                      </span>
                    </div>
                    <p className={d.evMsg}>{e.message}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {r.emails.length > 0 && (
            <Panel title="Emails" count={r.emails.length}>
              <ul className={a.list}>
                {r.emails.map((m) => (
                  <li key={m.id} className={a.listRow}>
                    <div className={a.listMain}>
                      <Link href={`/admin/emails?open=${m.id}`} className={a.rowLink}>
                        {m.subject}
                      </Link>
                      <div className={a.listMeta}>
                        To {m.to} · {fmt(m.createdAt, "MMM d, h:mmaaa")}
                        {m.error ? ` · ${m.error}` : ""}
                      </div>
                    </div>
                    <Pill tone={m.status === "failed" ? "danger" : m.status === "sent" ? "success" : "neutral"}>
                      {m.status === "logged" ? "Logged (dev)" : m.status === "sent" ? "Sent" : "Failed"}
                    </Pill>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className={`${a.stack} ${d.actionsFirst}`}>
          <Panel title="Actions">
            {canCheckIn(b, now) && (
              <div className={a.panelBody} style={{ borderBottom: "1px solid var(--a-line)" }}>
                <CheckInButton id={b.id} guest={b.contactName} checkedIn={Boolean(b.checkedInAt)} />
              </div>
            )}
            {(b.status === "completed" || b.status === "no_show" || (live && ended)) && (
              <div className={a.panelBody} style={{ borderBottom: "1px solid var(--a-line)" }}>
                <ActionForm action={setStatusAction} className={a.row}>
                  <input type="hidden" name="id" value={b.id} />
                  {live && ended && (
                    <>
                      <SubmitButton name="status" value="completed" className={`${a.btn} ${a.btnPrimary}`}>
                        Mark completed
                      </SubmitButton>
                      <SubmitButton name="status" value="no_show" className={a.btn}>
                        No-show
                      </SubmitButton>
                    </>
                  )}
                  {b.status !== "confirmed" && (
                    <SubmitButton name="status" value="confirmed" className={`${a.btn} ${a.btnSm}`}>
                      Undo: set back to confirmed
                    </SubmitButton>
                  )}
                </ActionForm>
              </div>
            )}

            {live && (
              <details className={a.disclosure} open={!ended && sp.do === "move" ? true : undefined}>
                <summary>Reschedule</summary>
                <div className={a.disclosureBody}>
                  <RescheduleForm
                    action={rescheduleAction}
                    bookingId={b.id}
                    experienceId={x.id}
                    currentDate={localDateKey(b.startAt)}
                    currentDuration={b.durationMinutes}
                    durations={x.durationOptions.map((o) => o.minutes)}
                    hasEmail={hasEmail}
                  />
                </div>
              </details>
            )}

            {showDeliverable && b.status !== "cancelled" && (
              <details className={a.disclosure} id="deliverable" open={b.status === "completed" && b.deliverableStatus !== "delivered" ? true : undefined}>
                <summary>
                  <span>
                    Track delivery <DeliverablePill status={b.deliverableStatus} />
                  </span>
                </summary>
                <div className={a.disclosureBody}>
                  <ActionForm action={deliverableAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <div className={a.field}>
                      <label htmlFor="dl-url">Download link (Dropbox, Drive, WeTransfer…)</label>
                      <input id="dl-url" name="url" type="url" className={a.input} defaultValue={b.deliverableUrl ?? ""} placeholder="https://" />
                    </div>
                    <label className={a.check}>
                      <input type="checkbox" name="notify" defaultChecked={hasEmail && b.deliverableStatus !== "delivered"} disabled={!hasEmail} />
                      <span>Email the guest the link when marked delivered</span>
                    </label>
                    <div className={a.formFoot}>
                      <SubmitButton name="status" value="delivered" pendingText="Saving…">
                        Mark delivered
                      </SubmitButton>
                      {b.deliverableStatus === "none" && (
                        <SubmitButton name="status" value="in_progress" className={a.btn}>
                          Working on it
                        </SubmitButton>
                      )}
                    </div>
                  </ActionForm>
                </div>
              </details>
            )}

            {remaining > 0 && b.status !== "pending_payment" && (
              <details className={a.disclosure}>
                <summary>Refund money</summary>
                <div className={a.disclosureBody}>
                  <ActionForm action={refundAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <p className={a.hint}>Refunds to the guest’s card without cancelling. Up to {formatMoney(remaining)} left.</p>
                    <div className={a.formRow}>
                      <div className={a.field}>
                        <label htmlFor="rf-amt">Amount</label>
                        <input id="rf-amt" name="amount" inputMode="decimal" className={a.input} placeholder={(remaining / 100).toFixed(2)} required />
                      </div>
                      <div className={a.field}>
                        <label htmlFor="rf-why">Reason</label>
                        <input id="rf-why" name="reason" className={a.input} placeholder="e.g. Ran short" />
                      </div>
                    </div>
                    <div className={a.formFoot}>
                      <SubmitButton className={`${a.btn} ${a.btnDanger}`} pendingText="Refunding…">
                        Refund
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </details>
            )}

            {live && hasEmail && (
              <details className={a.disclosure}>
                <summary>Resend confirmation</summary>
                <div className={a.disclosureBody}>
                  <ActionForm action={resendConfirmationAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <p className={a.hint}>
                      Sends the confirmation (with calendar invite and manage link) to {b.contactEmail} again.
                      {b.confirmationSentAt ? ` Last sent ${fmt(b.confirmationSentAt, "MMM d, h:mmaaa")}.` : ""}
                    </p>
                    <div className={a.formFoot}>
                      <SubmitButton className={a.btn} pendingText="Sending…">
                        <Icon name="mail" size={15} /> Send again
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </details>
            )}

            {(live || b.status === "pending_payment") && (
              <details className={a.disclosure}>
                <summary>Cancel booking</summary>
                <div className={a.disclosureBody}>
                  <CancelForm
                    action={cancelAction}
                    bookingId={b.id}
                    policyCents={policy.cardCents}
                    policyGiftCents={policy.giftCardCents}
                    policyEligible={policy.eligible}
                    remainingCents={remaining}
                    giftCardCents={b.giftCardCents}
                    cancellationHours={x.cancellationHours}
                    hasEmail={hasEmail}
                  />
                </div>
              </details>
            )}

            {!live && b.status !== "completed" && b.status !== "no_show" && b.status !== "pending_payment" && remaining === 0 && (
              <Empty>Nothing to do. This booking is {b.status === "cancelled" ? "cancelled" : "closed"}.</Empty>
            )}
          </Panel>

          {b.internalNotes && (
            <Panel title="Private notes">
              <div className={a.panelBody}>
                <p className={d.notes}>{b.internalNotes}</p>
              </div>
            </Panel>
          )}

          <Panel title="Links">
            <div className={a.panelBody}>
              <dl className={a.dl} style={{ gridTemplateColumns: "92px minmax(0,1fr)" }}>
                <dt>Guest page</dt>
                <dd>
                  <a href={manage} target="_blank" rel="noreferrer" className={`${a.ext} ${a.small}`}>
                    Open as guest
                  </a>
                </dd>
                {b.calBookingUid && (
                  <>
                    <dt>Cal.com</dt>
                    <dd className={a.mono}>{b.calBookingUid}</dd>
                  </>
                )}
                {b.stripePaymentIntentId && (
                  <>
                    <dt>Stripe</dt>
                    <dd className={a.mono}>{b.stripePaymentIntentId}</dd>
                  </>
                )}
              </dl>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
