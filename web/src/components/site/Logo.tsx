import Image from "next/image";
import Link from "next/link";
import styles from "./SiteHeader.module.css";

/** The client's purple stacked logo (logo 03, transparent PNG), on the light header. `size` is its height in px. */
export function LogoMark({ size = 60 }: { size?: number }) {
  return <Image src="/brand/logo-purple.png" alt="" width={Math.round(size * 0.884)} height={size} className={styles.mark} />;
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" className={styles.logo} aria-label="Raw Planet Experiences, home" onClick={onClick}>
      <LogoMark />
    </Link>
  );
}
