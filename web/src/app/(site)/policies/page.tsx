import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/site/JsonLd";
import { PageHeader } from "@/components/site/PageHeader";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { MAX_CUSTOMER_RESCHEDULES } from "@/lib/booking/service";
import { BUSINESS } from "@/lib/config";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "./policies.module.css";

export const metadata: Metadata = {
  title: "Policies: cancellations, terms & privacy",
  description: "Cancellation, rescheduling, refunds, gift cards, terms of booking and privacy for Raw Planet Experiences in New York City.",
  alternates: { canonical: "/policies" },
  openGraph: { url: "/policies" },
};

const TOC = [
  { id: "cancellations", label: "Cancelling & moving" },
  { id: "arrival", label: "On the day" },
  { id: "gift-cards", label: "Gift cards" },
  { id: "terms", label: "Terms of booking" },
  { id: "privacy", label: "Privacy" },
];

export default async function PoliciesPage() {
  const experiences = await getActiveExperiences();
  const max: number = MAX_CUSTOMER_RESCHEDULES;
  const times = max === 1 ? "once" : max === 2 ? "twice" : `${max} times`;
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Policies", path: "/policies" },
        ])}
      />
      <PageHeader
        crumbs={[{ name: "Policies" }]}
        title="Fair and simple."
        lede="Cancel for free up to the cutoff, move your session yourself, and get your money back the way you paid. Here are the details."
      />
      <div className={`wrap ${styles.layout}`}>
        <nav className={styles.toc} aria-label="On this page">
          <ul>
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`}>{t.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.body}>
          <section id="cancellations" aria-labelledby="c-title">
            <h2 id="c-title">Cancelling &amp; moving</h2>
            <div className={styles.tableWrap} role="region" aria-label="Free cancellation by experience" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Experience</th>
                    <th scope="col">Free cancellation &amp; changes until</th>
                  </tr>
                </thead>
                <tbody>
                  {experiences.map((e) => (
                    <tr key={e.slug}>
                      <th scope="row">
                        <Link href={`/experiences/${e.slug}`}>{e.shortName}</Link>
                      </th>
                      <td>{e.cancellationHours} hours before the start time</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul>
              <li>
                <strong>Full refund before the cutoff.</strong> Cancel from the &ldquo;Manage your booking&rdquo; link in your confirmation email and the
                money goes back to your card. Anything paid with a gift card goes back onto the gift card.
              </li>
              <li>
                <strong>Move it yourself.</strong> Pick any other open time from the same link, up to the same cutoff. You can move a booking {times}{" "}
                online; after that, just write to us.
              </li>
              <li>
                <strong>After the cutoff</strong> the session can&rsquo;t be cancelled or moved online, because Alex has kept the room for you. Reply to
                your confirmation email anyway: if we can fill the slot, we&rsquo;ll do what we can.
              </li>
              <li>
                <strong>If we have to cancel</strong> (illness, a studio problem), you choose: a new time or a full refund.
              </li>
              <li>Refunds usually reach your card within 5 to 10 business days, depending on your bank.</li>
            </ul>
          </section>

          <section id="arrival" aria-labelledby="a-title">
            <h2 id="a-title">On the day</h2>
            <ul>
              <li>The exact address and arrival instructions are in your confirmation email and on your booking page.</li>
              <li>
                Running late? Message us as soon as you can. Sessions after yours may be booked, so we can&rsquo;t always run over, but we&rsquo;ll make
                the most of the time you have.
              </li>
              <li>Guests under 18 need a parent or guardian to book. Music production is open to ages 10 and up.</li>
              <li>Everything you need is in the room. Alex will show you how the gear works; please treat it kindly.</li>
            </ul>
          </section>

          <section id="gift-cards" aria-labelledby="g-title">
            <h2 id="g-title">Gift cards</h2>
            <ul>
              <li>Gift cards work on any experience and can be used across more than one booking until the balance runs out.</li>
              <li>They are delivered by email, on the day you choose.</li>
              <li>
                Gift cards can&rsquo;t be exchanged for cash. If a booking paid with a gift card is cancelled in time, the amount goes back onto the card.
              </li>
            </ul>
          </section>

          <section id="terms" aria-labelledby="t-title">
            <h2 id="t-title">Terms of booking</h2>
            <p className={styles.template}>
              <span className="tag-ph">template</span> Draft wording for {BUSINESS.legalName} to review with a lawyer before launch.
            </p>
            <p>
              When you book, you agree to these policies. Sessions are run by {BUSINESS.legalName} in {BUSINESS.city}. Prices are shown in US dollars and
              include everything listed on the experience page unless an extra is marked as optional. Recordings and tracks you make in a music
              production session are yours to keep and share for personal use.
            </p>
            <p>
              We may take photos or short clips during a session to share online only if you say yes on the day. You can change your mind at any time by
              emailing us.
            </p>
          </section>

          <section id="privacy" aria-labelledby="p-title">
            <h2 id="p-title">Privacy</h2>
            <p className={styles.template}>
              <span className="tag-ph">template</span> Draft wording to review before launch.
            </p>
            <p>
              We collect what we need to run your booking: your name, email, phone number if you give it, and notes about your session. Payments are
              processed by Stripe; your card details go to Stripe and never touch our servers. Bookings are kept on a shared calendar so nobody gets
              double-booked.
            </p>
            <p>
              We email you about your booking (confirmation, reminder, a thank-you after). We don&rsquo;t sell your data or send marketing unless you ask
              for it. To see or delete what we hold about you, email{" "}
              <a href={`mailto:${BUSINESS.contactEmail}`} className="link">
                {BUSINESS.contactEmail}
              </a>
              .
            </p>
          </section>

          <p className={styles.updated}>
            Questions about any of this? <Link href="/contact" className="link">Contact us</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
