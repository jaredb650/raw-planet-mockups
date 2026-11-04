import Link from "next/link";
import styles from "./SiteHeader.module.css";

/** Planet-with-ring mark + wordmark. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
      <circle cx="16" cy="16" r="11" fill="var(--accent)" />
      <ellipse cx="16" cy="16.5" rx="15" ry="5.2" fill="none" stroke="var(--ink)" strokeWidth="2.4" transform="rotate(-18 16 16)" />
      <path d="M5.2 13.4a11 11 0 0 1 21.6 0" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" className={styles.logo} aria-label="Raw Planet Experiences, home" onClick={onClick}>
      <LogoMark />
      <span>Raw Planet</span>
    </Link>
  );
}
