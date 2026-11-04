import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { experiences } from "@/lib/db/schema";
import { getBookingForCustomer } from "@/lib/booking/service";
import { reconcileBookingPayment } from "@/app/api/_lib/stripe-sync";
import { BUSINESS } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { fmtDateLong, fmtTime } from "@/lib/time";
import { bookingCalendarEvent } from "@/components/booking/server/calendar-event";
import { BookingDetails } from "@/components/booking/server/BookingDetails";
import { StatusPoller } from "@/components/booking/StatusPoller";
import { themeOf } from "@/components/booking/format";
import styles from "@/components/booking/pages.module.css";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false }, referrer: "same-origin" };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingConfirmationPage({ params, searchParams }: Props) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const t = typeof sp.t === "string" ? sp.t : "";
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  let b = await getBookingForCustomer(code, t);
  if (!b) notFound();
  if (b.status === "pending_payment") b = await reconcileBookingPayment(b, sessionId);

  const db = await getDb();
  const [e] = await db.select().from(experiences).where(eq(experiences.id, b.experienceId)).limit(1);
  const manageHref = `/manage/${b.code}?t=${b.manageToken}`;
  const live = b.status === "confirmed" || b.status === "completed";
  const cal = live ? await bookingCalendarEvent(b, e) : null;
  const firstName = b.contactName.split(" ")[0];

  return (
    <section className={styles.page}>
      <div className="wrap">
        <div className={styles.layout}>
          <div>
            {b.status === "pending_payment" ? (
              <div className={styles.hero} data-tone="wait" role="status">
                <p className="eyebrow">Almost done</p>
                <h1>
                  <span className={styles.spinner} aria-hidden="true" />
                  Confirming
                </h1>
                <p>We&rsquo;re waiting for the payment to clear. This usually takes a few seconds.</p>
                <StatusPoller code={b.code} token={t} sessionId={sessionId} />
              </div>
            ) : live ? (
              <div className={styles.hero} data-theme={themeOf(e)}>
                <p className="eyebrow" style={{ color: "inherit", opacity: 0.85 }}>
                  Booking confirmed
                </p>
                <h1>You&rsquo;re in, {firstName}.</h1>
                <p>
                  See you {fmtDateLong(b.startAt)} at {fmtTime(b.startAt)}. We&rsquo;ve emailed your confirmation to{" "}
                  <strong>{b.contactEmail}</strong>.
                </p>
                <span className={styles.code}>Booking {b.code}</span>
              </div>
            ) : b.status === "expired" ? (
              <div className={styles.hero} data-tone="off">
                <p className="eyebrow">Hold expired</p>
                <h1>This time wasn&rsquo;t booked</h1>
                <p>The checkout wasn&rsquo;t completed, so no payment was taken and the time was released.</p>
                <div className={styles.actions}>
                  <Link className="btn btn--accent" href={`/book/${e.slug}`}>
                    Pick a new time
                  </Link>
                </div>
              </div>
            ) : (
              <div className={styles.hero} data-tone="off">
                <p className="eyebrow">{b.status === "no_show" ? "Missed session" : "Cancelled"}</p>
                <h1>{b.status === "no_show" ? "We missed you" : "Booking cancelled"}</h1>
                <p>
                  {b.amountRefundedCents > 0
                    ? `${formatMoney(b.amountRefundedCents)} was refunded to your card. It can take 5 to 10 days to show.`
                    : "If you have questions, reply to any of our emails."}
                </p>
                <div className={styles.actions}>
                  <Link className="btn btn--accent" href={`/book/${e.slug}`}>
                    Book again
                  </Link>
                </div>
              </div>
            )}

            {live && cal ? (
              <div className={styles.actions}>
                <a className="btn" href={`/api/bookings/${b.code}/ics?t=${b.manageToken}`}>
                  Add to calendar (.ics)
                </a>
                <a className="btn btn--ghost" href={cal.googleUrl} target="_blank" rel="noopener noreferrer">
                  Google Calendar
                </a>
                <Link className="btn btn--ghost" href={manageHref}>
                  Change or cancel
                </Link>
              </div>
            ) : null}

            {live ? (
              <div className={styles.cardSoft} style={{ marginTop: 32 }}>
                <h2 className={styles.cardTitle}>What happens next</h2>
                <ol className={styles.timeline}>
                  <li>
                    <div>
                      <p>Booking confirmed</p>
                      <time>Your confirmation email is on its way</time>
                    </div>
                  </li>
                  <li data-future>
                    <div>
                      <p>Reminder the day before</p>
                      <time>With the address and how to get in</time>
                    </div>
                  </li>
                  <li data-future>
                    <div>
                      <p>Your session with {BUSINESS.host.split(" ")[0]}</p>
                      <time>
                        {fmtDateLong(b.startAt)}, {fmtTime(b.startAt)}
                      </time>
                    </div>
                  </li>
                  {e.theme === "production" ? (
                    <li data-future>
                      <div>
                        <p>Your track lands in your inbox</p>
                        <time>Usually within a week</time>
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
              Keep this link private: anyone with it can manage your booking.{" "}
              <Link href={manageHref} className="link">
                Manage booking
              </Link>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
