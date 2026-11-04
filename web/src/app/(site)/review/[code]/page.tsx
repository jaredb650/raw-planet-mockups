import type { Metadata } from "next";
import Link from "next/link";
import { getExperienceSummary, getReviewForBooking, reviewEligibility } from "@/components/site/queries";
import { ReviewForm } from "@/components/site/ReviewForm";
import { getBookingForReview } from "@/lib/review-token";
import { fmtDateLong } from "@/lib/time";
import styles from "./review.module.css";

export const metadata: Metadata = {
  title: "Leave a review",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({ params, searchParams }: PageProps<"/review/[code]">) {
  const { code } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const booking = token ? await getBookingForReview(code, token) : undefined;

  if (!booking) {
    return (
      <Shell title="This link doesn't look right.">
        <p className="lede">
          Review links are personal, so they only work straight from your email. Open the &ldquo;Leave a review&rdquo; button in the thank-you email
          we sent after your session.
        </p>
        <p>
          Can&rsquo;t find it? <Link href="/contact" className="link">Write to us</Link> and we&rsquo;ll send a fresh one.
        </p>
      </Shell>
    );
  }

  const [exp, existing] = await Promise.all([getExperienceSummary(booking.experienceId), getReviewForBooking(booking.id)]);
  const expName = exp?.shortName ?? "your";
  const firstName = booking.contactName.trim().split(/\s+/)[0] ?? "";

  if (existing) {
    return (
      <Shell title={`Thank you, ${firstName}!`} theme={exp?.theme}>
        <p className="lede">
          You already left a review for this session{existing.status === "published" ? " and it's live on the site" : ". Alex will publish it after he's read it"}.
        </p>
        <div className={styles.ctas}>
          <Link href="/reviews" className="btn btn--accent">
            Read reviews
          </Link>
          <Link href="/experiences" className="btn btn--ghost">
            Book another session
          </Link>
        </div>
      </Shell>
    );
  }

  const can = reviewEligibility(booking);
  if (!can.ok) {
    return (
      <Shell title={can.reason === "not_yet" ? "Come back after your session." : "This booking can't be reviewed."} theme={exp?.theme}>
        <p className="lede">
          {can.reason === "not_yet"
            ? `Your ${expName.toLowerCase()} session is on ${fmtDateLong(booking.startAt)}. We'll email you a review link afterwards.`
            : "Reviews are for sessions that went ahead. If that's not right, please get in touch."}
        </p>
        <div className={styles.ctas}>
          <Link href={`/booking/${booking.code}?t=${encodeURIComponent(token)}`} className="btn btn--ghost">
            View your booking
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={`How was it, ${firstName}?`} theme={exp?.theme} eyebrow={`${expName} · ${fmtDateLong(booking.startAt)}`}>
      <p className="lede">Two minutes of your time helps a small studio more than you&rsquo;d think, and it helps the next first-timer decide.</p>
      <div className={styles.card}>
        <ReviewForm code={booking.code} token={token} defaultName={firstName} experienceName={expName === "your" ? "the" : expName} />
      </div>
    </Shell>
  );
}

function Shell({ title, eyebrow, theme, children }: { title: string; eyebrow?: string; theme?: string; children: React.ReactNode }) {
  return (
    <section className={styles.page} data-theme={theme} aria-labelledby="review-title">
      <div className="wrap-narrow">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 id="review-title" className={styles.title}>
          {title}
        </h1>
        {children}
      </div>
    </section>
  );
}
