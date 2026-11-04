import type { Metadata } from "next";
import Link from "next/link";
import { InquiryForm } from "@/components/site/InquiryForm";
import { JsonLd } from "@/components/site/JsonLd";
import { PageHeader } from "@/components/site/PageHeader";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { BUSINESS } from "@/lib/config";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "./contact.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about a session, a group or a gift? Write to Alex at Raw Planet Experiences. English or Spanish.",
  alternates: { canonical: "/contact" },
  openGraph: { url: "/contact" },
};

export default async function ContactPage() {
  const experiences = await getActiveExperiences();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <PageHeader
        crumbs={[{ name: "Contact" }]}
        title="Ask us anything."
        lede="A question before you book, a special request or an idea for a collab. Alex reads every message and replies personally, in English or Spanish."
      />
      <section className={styles.section} aria-label="Contact options">
        <div className={`wrap ${styles.grid}`}>
          <div className={styles.formCard}>
            <h2 className={styles.h2}>Send a message</h2>
            <InquiryForm variant="contact" experiences={experiences.map((e) => ({ slug: e.slug, shortName: e.shortName }))} />
          </div>
          <aside className={styles.side} aria-label="Other ways to reach us">
            <div className={styles.tile}>
              <h2 className={styles.h3}>Email</h2>
              <p>
                <a href={`mailto:${BUSINESS.contactEmail}`} className="link">
                  {BUSINESS.contactEmail}
                </a>
              </p>
            </div>
            <div className={styles.tile}>
              <h2 className={styles.h3}>Already booked?</h2>
              <p>Reply to your confirmation email, or manage your booking yourself: move it to another time or cancel it.</p>
              <Link href="/manage" className="btn btn--ghost btn--sm">
                Manage a booking
              </Link>
            </div>
            <div className={styles.tile}>
              <h2 className={styles.h3}>Planning for a group?</h2>
              <p>Parties, team days and sound baths for 10 or more get their own request form.</p>
              <Link href="/groups#request" className="btn btn--ghost btn--sm">
                Group request
              </Link>
            </div>
            <div className={styles.tile}>
              <h2 className={styles.h3}>Follow along</h2>
              <ul className={styles.social}>
                <li>
                  <a href={BUSINESS.instagram} className="link" target="_blank" rel="noopener">
                    Instagram
                  </a>
                </li>
                <li>
                  <a href={BUSINESS.soundcloud} className="link" target="_blank" rel="noopener">
                    SoundCloud
                  </a>
                </li>
                {BUSINESS.meetupGroupUrl ? (
                  <li>
                    <a href={BUSINESS.meetupGroupUrl} className="link" target="_blank" rel="noopener">
                      Meetup
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
            <p className={styles.note}>
              The studio address is sent with your booking confirmation. We don&rsquo;t take walk-ins.{" "}
              <Link href="/faq" className="link">
                Read the FAQ
              </Link>
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
