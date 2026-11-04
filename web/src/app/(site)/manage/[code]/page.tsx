import type { Metadata } from "next";
import { reviewToken } from "@/lib/review-token";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookingEvents, experiences } from "@/lib/db/schema";
import { MAX_CUSTOMER_RESCHEDULES, getBookingForCustomer } from "@/lib/booking/service";
import { refundForCancellation } from "@/lib/booking/pricing";
import { BUSINESS } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { fmt, fmtDateLong, fmtTime } from "@/lib/time";
import { bookingCalendarEvent } from "@/components/booking/server/calendar-event";
import { BookingDetails } from "@/components/booking/server/BookingDetails";
import { RescheduleForm } from "@/components/booking/RescheduleForm";
import { CancelDialog } from "@/components/booking/CancelDialog";
import { noticeLabel, themeOf } from "@/components/booking/format";
import styles from "@/components/booking/pages.module.css";
import { cancelAction, rescheduleAction } from "./actions";

export const metadata: Metadata = { title: "Manage your booking", robots: { index: false, follow: false }, referrer: "same-origin" };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ManageBookingPage({ params, searchParams }: Props) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const t = typeof sp.t === "string" ? sp.t : "";
  const done = typeof sp.done === "string" ? sp.done : null;
  const b = t ? await getBookingForCustomer(code, t) : undefined;

  if (!b) {
    return (
      <section className={styles.page}>
        <div className="wrap-narrow">
          <div className={styles.hero} data-tone="off">
            <p className="eyebrow">Manage booking</p>
            <h1>Link not valid</h1>
            <p>This link is incomplete or has expired. We can email you a fresh one.</p>
            <div className={styles.actions}>
              <Link className="btn btn--accent" href="/manage">
                Send me a new link
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const db = await getDb();
  const [[e], events] = await Promise.all([
    db.select().from(experiences).where(eq(experiences.id, b.experienceId)).limit(1),
    db
      .select({ id: bookingEvents.id, type: bookingEvents.type, message: bookingEvents.message, at: bookingEvents.createdAt })
      .from(bookingEvents)
      .where(and(eq(bookingEvents.bookingId, b.id), eq(bookingEvents.public, true)))
      .orderBy(asc(bookingEvents.createdAt)),
  ]);

  const now = new Date();
  const upcoming = b.status === "confirmed" && b.startAt > now;
  const deadline = new Date(b.startAt.getTime() - e.cancellationHours * 3600_000);
  const canChange = upcoming && now <= deadline;
  const movesLeft = Math.max(0, MAX_CUSTOMER_RESCHEDULES - b.rescheduleCount);
  const policy = refundForCancellation({
    startAt: b.startAt,
    cancellationHours: e.cancellationHours,
    amountPaidCents: b.amountPaidCents,
    amountRefundedCents: b.amountRefundedCents,
    giftCardCents: b.giftCardCents,
  });
  const refundParts = [
    policy.cardCents > 0 ? `${formatMoney(policy.cardCents)} back to your card` : null,
    policy.giftCardCents > 0 ? `${formatMoney(policy.giftCardCents)} back on your gift card` : null,
  ].filter(Boolean);
  const refundText = refundParts.length
    ? `You'll get ${refundParts.join(" and ")}. Card refunds take 5 to 10 days to show.`
    : "Nothing was charged for this booking, so there's nothing to refund.";
  const cal = b.status === "confirmed" || b.status === "completed" ? await bookingCalendarEvent(b, e) : null;
  const theme = themeOf(e);

  const statusCopy: Record<string, { eyebrow: string; title: string; body: string; tone?: string }> = {
    confirmed: {
      eyebrow: "Confirmed",
      title: upcoming ? `See you ${fmt(b.startAt, "EEEE")}` : "Session time passed",
      body: upcoming ? `${fmtDateLong(b.startAt)} at ${fmtTime(b.startAt)}, New York time.` : "We hope you had a great time.",
    },
    completed: { eyebrow: "Completed", title: "Thanks for coming", body: "We hope you had a great session." },
    cancelled: {
      eyebrow: "Cancelled",
      title: "Booking cancelled",
      body: b.amountRefundedCents > 0 ? `${formatMoney(b.amountRefundedCents)} refunded to your card.` : "This booking won't go ahead.",
      tone: "off",
    },
    pending_payment: { eyebrow: "Waiting for payment", title: "Not booked yet", body: "We haven't received the payment for this booking.", tone: "wait" },
    expired: { eyebrow: "Expired", title: "Not booked", body: "The checkout wasn't completed, so this time was released.", tone: "off" },
    no_show: { eyebrow: "Missed", title: "We missed you", body: "Reply to any of our emails if you'd like to book again.", tone: "off" },
  };
  const s = statusCopy[b.status] ?? statusCopy.confirmed;

  return (
    <section className={styles.page}>
      <div className="wrap">
        {done === "moved" ? (
          <p className="notice notice--success" role="status" style={{ marginBottom: 20 }}>
            Done. Your session is now on {fmtDateLong(b.startAt)} at {fmtTime(b.startAt)}. We&rsquo;ve emailed you the new details.
          </p>
        ) : done === "cancelled" ? (
          <p className="notice notice--success" role="status" style={{ marginBottom: 20 }}>
            Your booking is cancelled. We&rsquo;ve sent a confirmation email.
          </p>
        ) : null}
        <div className={styles.layout}>
          <div className={styles.stack} style={{ gap: 28 }}>
            <div className={styles.hero} data-theme={s.tone ? undefined : theme} data-tone={s.tone}>
              <p className="eyebrow" style={{ color: "inherit", opacity: 0.85 }}>
                {s.eyebrow} · {b.code}
              </p>
              <h1>{s.title}</h1>
              <p>{s.body}</p>
              {cal ? (
                <div className={styles.actions}>
                  <a className="btn btn--light" href={`/api/bookings/${b.code}/ics?t=${b.manageToken}`}>
                    Add to calendar
                  </a>
                  <a className="btn btn--light" href={cal.googleUrl} target="_blank" rel="noopener noreferrer">
                    Google Calendar
                  </a>
                </div>
              ) : null}
            </div>

            {b.deliverableStatus === "delivered" && b.deliverableUrl ? (
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Your track is ready</h2>
                <p className="muted">Download it, share it, play it loud.</p>
                <a className="btn btn--accent" href={b.deliverableUrl} target="_blank" rel="noopener noreferrer" data-theme={theme}>
                  Get your track
                </a>
              </div>
            ) : b.deliverableStatus === "in_progress" ? (
              <p className="notice">Alex is finishing your track. We&rsquo;ll email you when it&rsquo;s ready.</p>
            ) : null}

            {b.status === "completed" ? (
              <div className={styles.cardSoft}>
                <h2 className={styles.cardTitle}>How was it?</h2>
                <p className="muted">A few words help other people find their way to the studio.</p>
                <Link className="btn" href={`/review/${b.code}?t=${reviewToken(b.id)}`}>
                  Leave a review
                </Link>
              </div>
            ) : null}

            {upcoming ? (
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>Change date or time</h2>
                  {canChange ? <span className="pill small">{movesLeft} {movesLeft === 1 ? "change" : "changes"} left</span> : null}
                </div>
                {!canChange ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Online changes close {noticeLabel(e.cancellationHours)} before your session. Need to change something? Email{" "}
                    <a className="link" href={`mailto:${BUSINESS.contactEmail}?subject=${encodeURIComponent(`Booking ${b.code}`)}`}>
                      {BUSINESS.contactEmail}
                    </a>{" "}
                    and we&rsquo;ll do what we can.
                  </p>
                ) : movesLeft === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    This booking has been moved twice already. Reply to your confirmation email and we&rsquo;ll help.
                  </p>
                ) : (
                  <>
                    <p className="muted">
                      Free until {fmtDateLong(deadline)}, {fmtTime(deadline)}. Same length and price; your old time is released.
                    </p>
                    <RescheduleForm
                      action={rescheduleAction}
                      code={b.code}
                      token={t}
                      slug={e.slug}
                      theme={theme}
                      duration={b.durationMinutes}
                      currentStart={b.startAt.toISOString()}
                      maxAdvanceDays={e.maxAdvanceDays}
                    />
                  </>
                )}
              </div>
            ) : null}

            {upcoming ? (
              <div className={styles.cardSoft}>
                <h2 className={styles.cardTitle}>Cancel</h2>
                {canChange ? (
                  <>
                    <p className="muted">
                      Free cancellation until {fmtDateLong(deadline)}, {fmtTime(deadline)}. {refundText}
                    </p>
                    <CancelDialog action={cancelAction} code={b.code} token={t} refundText={refundText} />
                  </>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    Free cancellation ended {noticeLabel(e.cancellationHours)} before your session. If something has come up, reply
                    to your confirmation email.
                  </p>
                )}
              </div>
            ) : null}

            {events.length ? (
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Booking history</h2>
                <ol className={styles.timeline}>
                  {events.map((ev) => (
                    <li key={ev.id}>
                      <div>
                        <p>{ev.message}</p>
                        <time dateTime={ev.at.toISOString()}>{fmt(ev.at, "MMM d, yyyy 'at' h:mmaaa")}</time>
                      </div>
                    </li>
                  ))}
                  {upcoming ? (
                    <li data-future>
                      <div>
                        <p>Your session</p>
                        <time>
                          {fmtDateLong(b.startAt)}, {fmtTime(b.startAt)}
                        </time>
                      </div>
                    </li>
                  ) : null}
                </ol>
              </div>
            ) : null}
          </div>

          <aside className={styles.aside}>
            <BookingDetails booking={b} experience={e} />
            <p className="small muted" style={{ marginTop: 16 }}>
              Questions? Reply to your confirmation email or write to{" "}
              <a className="link" href={`mailto:${BUSINESS.contactEmail}`}>
                {BUSINESS.contactEmail}
              </a>
              .
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
