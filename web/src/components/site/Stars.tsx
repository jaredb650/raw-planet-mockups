import styles from "./Stars.module.css";

const STAR = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z";

/** Read-only star row. Pass `label` to announce it; otherwise it's decorative. */
export function Stars({ value, size = 18, label }: { value: number; size?: number; label?: string }) {
  const full = Math.round(value * 2) / 2;
  return (
    <span className={styles.stars} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = full >= i ? 1 : full >= i - 0.5 ? 0.5 : 0;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <clipPath id={`half-${i}-${size}`}>
                <rect x="0" y="0" width={12} height="24" />
              </clipPath>
            </defs>
            <path d={STAR} className={styles.empty} />
            {fill > 0 ? <path d={STAR} className={styles.full} clipPath={fill < 1 ? `url(#half-${i}-${size})` : undefined} /> : null}
          </svg>
        );
      })}
    </span>
  );
}

export function RatingBadge({ score, count, compact }: { score: number; count: number; compact?: boolean }) {
  return (
    <span className={styles.badge}>
      <Stars value={score} size={compact ? 15 : 18} />
      <strong className="tabular" aria-hidden="true">{score.toFixed(2)}</strong>
      <span className={styles.count} aria-hidden="true">({count}{compact ? "" : " ratings"})</span>
      <span className="sr-only">
        Rated {score.toFixed(2)} out of 5 from {count} ratings
      </span>
    </span>
  );
}
