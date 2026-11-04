import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/config";
import { ManageFinder } from "@/components/booking/ManageFinder";
import { noticeLabel } from "@/components/booking/format";
import { getActiveExperiences } from "@/lib/queries/public";
import { MAX_CUSTOMER_RESCHEDULES } from "@/lib/booking/service";
import styles from "@/components/booking/pages.module.css";
import { requestManageLinks } from "./actions";

export const metadata: Metadata = {
  title: "Manage your booking",
  description: "Change the time of your session, cancel, or get your confirmation again.",
  alternates: { canonical: "/manage" },
};

export default async function ManagePage() {
  const experiences = await getActiveExperiences();
  return (
    <section className={styles.page}>
      <div className="wrap">
        <header className={styles.head}>
          <div>
            <p className="eyebrow">Your booking</p>
            <h1 className={styles.title}>Manage it</h1>
          </div>
          <p className="lede">Move your session, cancel, or grab your confirmation again. No account or password needed.</p>
        </header>
        <div className={styles.layout}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Get your booking link</h2>
            <p className="muted">
              Every confirmation email has a &ldquo;Manage booking&rdquo; button. Can&rsquo;t find it? Enter your email and we&rsquo;ll
              send it again.
            </p>
            <ManageFinder action={requestManageLinks} />
          </div>
          <aside className={styles.aside}>
            <div className={styles.cardSoft}>
              <h2 className={styles.cardTitle}>Good to know</h2>
              <ul className={styles.trust}>
                {experiences.map((e) => (
                  <li key={e.slug}>
                    {e.shortName}: free cancellation up to {noticeLabel(e.cancellationHours)} before.
                  </li>
                ))}
                <li>You can move your session yourself, up to {MAX_CUSTOMER_RESCHEDULES === 2 ? "twice" : `${MAX_CUSTOMER_RESCHEDULES} times`}.</li>
                <li>Refunds go back to your card in 5 to 10 days.</li>
                <li>Booked through Airbnb? Manage it in the Airbnb app.</li>
              </ul>
              <p className="small" style={{ margin: "16px 0 0" }}>
                Something else?{" "}
                <a className="link" href={`mailto:${BUSINESS.contactEmail}`}>
                  {BUSINESS.contactEmail}
                </a>{" "}
                or <Link className="link" href="/contact">send us a message</Link>.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
