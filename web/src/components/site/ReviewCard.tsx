import { fmt } from "@/lib/time";
import type { PublicReview } from "@/lib/queries/public";
import { Stars } from "./Stars";
import styles from "./ReviewCard.module.css";

const SOURCE: Record<string, string> = { airbnb: "Airbnb", direct: "Booked direct", google: "Google", viator: "Viator" };

export function ReviewCard({ review, experienceName, showStars = true }: { review: PublicReview; experienceName?: string; showStars?: boolean }) {
  return (
    <figure className={styles.card} id={`review-${review.id}`}>
      {showStars ? <Stars value={review.rating} label={`${review.rating} out of 5 stars`} /> : null}
      <blockquote className={styles.body}>
        <p>&ldquo;{review.body}&rdquo;</p>
      </blockquote>
      <figcaption className={styles.cite}>
        <span className={styles.avatar} aria-hidden="true">
          {review.name.charAt(0)}
        </span>
        <span>
          <strong>{review.name}</strong>
          {review.location ? <span className={styles.loc}>{review.location}</span> : null}
          <span className={styles.meta}>
            {[experienceName, SOURCE[review.source] ?? review.source, review.date ? fmt(review.date, "MMM yyyy") : null].filter(Boolean).join(" · ")}
          </span>
        </span>
      </figcaption>
      {review.hostReply ? (
        <div className={styles.reply}>
          <strong>Alex replied</strong>
          <p>{review.hostReply}</p>
        </div>
      ) : null}
    </figure>
  );
}
