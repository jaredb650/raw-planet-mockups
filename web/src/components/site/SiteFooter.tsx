import Link from "next/link";
import { BUSINESS } from "@/lib/config";
import styles from "./SiteFooter.module.css";

export function SiteFooter({ experiences }: { experiences: { slug: string; shortName: string }[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.foot}>
      <div className="wrap">
        <div className={styles.bigRow}>
          <p className={styles.big}>
            <Link href="/book">
              Book an experience
            </Link>
          </p>
          <p className={styles.bigSide}>
            Music production, DJ and meditation experiences in New York City. No experience needed.
            <span className={styles.lang}>English &amp; Español</span>
          </p>
        </div>
        <div className={styles.cols}>
          <div>
            <h2 className={styles.h}>Experiences</h2>
            {experiences.map((e) => (
              <Link key={e.slug} href={`/experiences/${e.slug}`}>
                {e.shortName}
              </Link>
            ))}
            <Link href="/groups">Private sessions &amp; groups</Link>
          </div>
          <div>
            <h2 className={styles.h}>Plan</h2>
            <Link href="/book">Book a session</Link>
            <Link href="/gift-cards">Gift cards</Link>
            <Link href="/manage">Manage a booking</Link>
            <Link href="/events">Community events</Link>
          </div>
          <div>
            <h2 className={styles.h}>Raw Planet</h2>
            <Link href="/about">About</Link>
            <Link href="/reviews">Reviews</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/policies">Policies</Link>
          </div>
          <div>
            <h2 className={styles.h}>Say hello</h2>
            <a href={`mailto:${BUSINESS.contactEmail}`}>{BUSINESS.contactEmail}</a>
            <Link href="/contact">Contact form</Link>
            <a href={BUSINESS.instagram} rel="noopener" target="_blank">Instagram</a>
            <a href={BUSINESS.soundcloud} rel="noopener" target="_blank">SoundCloud</a>
            {BUSINESS.meetupGroupUrl ? (
              <a href={BUSINESS.meetupGroupUrl} rel="noopener" target="_blank">Meetup</a>
            ) : null}
          </div>
        </div>
        <div className={styles.legal}>
          <span className={styles.legalMark}>
            © {year} {BUSINESS.legalName}
          </span>
          <span>New York City</span>
          <Link href="/policies#privacy">Privacy</Link>
          <Link href="/policies#terms">Terms</Link>
          <Link href="/policies#cookies">Cookies</Link>
          <Link href="/policies#accessibility">Accessibility</Link>
        </div>
      </div>
    </footer>
  );
}
