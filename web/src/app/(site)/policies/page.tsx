import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/site/JsonLd";
import { PageHeader } from "@/components/site/PageHeader";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { getStringSetting } from "@/lib/automation/settings";
import { MAX_CUSTOMER_RESCHEDULES } from "@/lib/booking/service";
import { BUSINESS } from "@/lib/config";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "./policies.module.css";

export const metadata: Metadata = {
  title: "Policies: terms, privacy, cookies & cancellations",
  description:
    "Cancellation and refund policy, gift card terms, Terms of Service, Privacy Policy, Cookie Policy, and Accessibility Statement for Raw Planet Experiences in New York City.",
  alternates: { canonical: "/policies" },
  openGraph: { url: "/policies" },
};

const LAST_UPDATED = "November 25, 2026";

const TOC = [
  { id: "cancellations", label: "Cancelling & moving" },
  { id: "arrival", label: "On the day & safety" },
  { id: "gift-cards", label: "Gift cards" },
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "cookies", label: "Cookie Policy" },
  { id: "accessibility", label: "Accessibility" },
  { id: "contact-legal", label: "Business & legal contact" },
];

export default async function PoliciesPage() {
  const [experiences, postalAddress, hostPhone] = await Promise.all([
    getActiveExperiences(),
    getStringSetting("postalAddress"),
    getStringSetting("hostPhone"),
  ]);
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
        title="Policies & legal"
        lede="Cancel for free up to the cutoff, move your session yourself, and read our full Terms of Service, Privacy Policy, Cookie Policy, and Accessibility Statement."
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
                money goes back to your original payment method. Any portion paid with a gift card is credited back to that gift card.
              </li>
              <li>
                <strong>Reschedule online.</strong> Pick another open time from your manage link up to the same cutoff. You can reschedule online up to{" "}
                {times}; after that, contact us directly.
              </li>
              <li>
                <strong>After the cutoff.</strong> Bookings cannot be cancelled or rescheduled online after the cutoff because studio time and host
                availability are reserved exclusively for your session. Reply to your confirmation email anyway: if we can refill the slot, we will do
                what we can.
              </li>
              <li>
                <strong>No-shows.</strong> Guests who do not arrive for a scheduled session without notice before the cutoff are not eligible for a
                refund.
              </li>
              <li>
                <strong>If we must cancel.</strong> In the rare event we need to cancel or reschedule (such as illness, studio emergency, or severe
                weather), you may choose either a rescheduled time or a 100% refund.
              </li>
              <li>Card refunds typically appear on your statement within 5 to 10 business days, depending on your financial institution.</li>
            </ul>
          </section>

          <section id="arrival" aria-labelledby="a-title">
            <h2 id="a-title">On the day &amp; safety</h2>
            <ul>
              <li>
                <strong>Studio address &amp; entry.</strong> Because sessions take place in working private studios, the street address and entry
                instructions are sent after booking confirmation. We do not accept walk-ins.
              </li>
              <li>
                <strong>Punctuality.</strong> Please arrive on time. Sessions are scheduled back-to-back, so late arrivals cannot be guaranteed extra
                time or extensions.
              </li>
              <li>
                <strong>Age &amp; minors.</strong> Anyone under 18 must have a parent or legal guardian complete the booking and sign the participation
                waiver on their behalf. Music production sessions welcome ages 10 and up.
              </li>
              <li>
                <strong>Studio equipment &amp; conduct.</strong> All instruments, studio gear, and DJ equipment are provided. Please follow your
                host&rsquo;s instructions and treat all equipment with care. We reserve the right to end a session without refund if a guest arrives
                visibly intoxicated, behaves unsafely or abusively, or intentionally damages studio property.
              </li>
              <li>
                <strong>Sound &amp; wellness notice.</strong> Music production and DJ sessions take place in active studios and may involve elevated sound
                levels; let your host know if you have sound sensitivity or need lower volume. Sound meditation sessions are for relaxation and creative
                enjoyment only and are not medical, psychological, or therapeutic treatment.
              </li>
            </ul>
          </section>

          <section id="gift-cards" aria-labelledby="g-title">
            <h2 id="g-title">Gift cards</h2>
            <ul>
              <li>Gift cards are issued by {BUSINESS.legalName} and can be redeemed toward any bookable experience on our website.</li>
              <li>
                <strong>No expiration or fees.</strong> In accordance with New York law (NY Gen. Bus. Law &sect; 396-i), gift cards do not expire and
                carry no inactivity, dormancy, or service fees.
              </li>
              <li>Unused balances stay on the card for future bookings until the balance reaches zero.</li>
              <li>
                Gift cards are delivered electronically by email immediately or on your chosen delivery date. Please double-check the recipient&rsquo;s
                email address before checkout.
              </li>
              <li>
                Gift cards are non-refundable and cannot be redeemed for cash, except where required by law (including New York&rsquo;s right to redeem a
                remaining gift card balance of less than $5.00 for cash upon request). If a booking paid with a gift card is cancelled within the free
                cancellation window, the redeemed amount returns to the same gift card.
              </li>
            </ul>
          </section>

          <section id="terms" aria-labelledby="t-title">
            <h2 id="t-title">Terms of Service</h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to this website and your booking or attendance at any session, workshop, or
              community event offered by <strong>{BUSINESS.legalName}</strong> (&ldquo;{BUSINESS.name},&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
              &ldquo;our&rdquo;) in {BUSINESS.city}. By accessing the site, purchasing a gift card, or booking an experience, you agree to these Terms.
            </p>

            <h3>1. Bookings, pricing &amp; payment</h3>
            <p>
              All prices are listed in US dollars (USD). Bookings are confirmed once full payment is authorized through our payment processor, Stripe (or
              covered by a valid gift card or promo code). During checkout, a time slot is temporarily held for up to 30 minutes while payment completes;
              unpaid holds expire automatically. You represent that you are authorized to use the payment method submitted and agree to contact us
              directly to resolve any billing issue before initiating a payment dispute.
            </p>

            <h3>2. Shared vs. private sessions</h3>
            <p>
              Standard online bookings are shared sessions up to the listed maximum party size unless you book a dedicated private session. Full private
              buyouts are arranged separately through our{" "}
              <Link href="/groups" className="link">
                Private sessions &amp; groups
              </Link>{" "}
              request form.
            </p>

            <h3>3. Participation waiver &amp; assumption of risk</h3>
            <p>
              Before attending a session, each participant (or a parent/legal guardian for minors) may be required to sign our online Participation &amp;
              Recording Release waiver. Participating in an in-person studio experience involves ordinary risks associated with audio equipment, cables,
              sound levels, and studio facilities. By attending, you voluntarily assume those ordinary risks to the fullest extent permitted by New York
              law.
            </p>

            <h3>4. Intellectual property &amp; recordings</h3>
            <p>
              Tracks, mixes, and audio bounces created during your session are provided to you for your personal, non-commercial listening and sharing
              (such as social media or sharing with friends and family). Any commercial release or monetization involving pre-existing studio instrumentals,
              samples, or host compositions requires separate written agreement. All website copy, logos, photography, branding, and instructional
              materials remain the property of {BUSINESS.legalName} or its licensors.
            </p>

            <h3>5. Photos &amp; video during sessions</h3>
            <p>
              Promotional photography or video recording of guests is optional. We only feature identifiable photos or clips of you publicly if you give
              consent (via the optional release checkbox on your waiver or verbally on the day). You may withdraw consent for future promotional use at
              any time by emailing{" "}
              <a href={`mailto:${BUSINESS.contactEmail}`} className="link">
                {BUSINESS.contactEmail}
              </a>
              .
            </p>

            <h3>6. Limitation of liability &amp; indemnification</h3>
            <p>
              To the maximum extent permitted by applicable law, {BUSINESS.legalName}, its owners, hosts, contractors, and studio partners shall not be
              liable for any indirect, incidental, consequential, special, or punitive damages, or for loss of personal belongings brought into a studio.
              To the extent permitted by New York law, our total aggregate liability arising out of or relating to any booking or use of this website
              shall not exceed the total amount actually paid by you for the specific session giving rise to the claim. Nothing in these Terms limits
              liability for gross negligence, willful misconduct, or any right that cannot legally be waived under New York law.
            </p>

            <h3>7. Force majeure</h3>
            <p>
              We are not liable for delays or cancellations caused by events beyond our reasonable control, including severe weather, transit or utility
              outages, building emergencies, public health orders, or third-party service interruptions. In such cases, we will work with you to
              reschedule or issue a full refund.
            </p>

            <h3>8. Governing law, disputes &amp; changes</h3>
            <p>
              These Terms are governed by the laws of the State of New York, without regard to conflict-of-law principles. Any dispute arising under these
              Terms that cannot be resolved informally shall be brought in the state or federal courts located in New York, New York. If any provision of
              these Terms is held unenforceable, the remaining provisions stay in full effect. We may update these Terms from time to time by posting a
              revised date at the bottom of this page; the version in effect when you complete a booking applies to that booking.
            </p>
          </section>

          <section id="privacy" aria-labelledby="p-title">
            <h2 id="p-title">Privacy Policy</h2>
            <p>
              This Privacy Policy explains how <strong>{BUSINESS.legalName}</strong> collects, uses, stores, and protects personal information when you
              visit our website, submit an inquiry, RSVP to an event, purchase a gift card, or book a session.
            </p>

            <h3>1. Information we collect</h3>
            <ul>
              <li>
                <strong>Booking &amp; contact details:</strong> name, email address, phone number (if provided), preferred language (English or Spanish),
                session date/experience, party size, occasion, gift recipient details, and any notes you include.
              </li>
              <li>
                <strong>Payment information:</strong> payments are processed directly by <strong>Stripe</strong>. We receive payment confirmation status,
                totals, and Stripe reference IDs, but your full credit/debit card number and CVC never touch or pass through our servers.
              </li>
              <li>
                <strong>Waiver &amp; review records:</strong> when you sign a waiver or submit a review, we store your typed name, minor&rsquo;s name (if
                applicable), consent selections, timestamp, and—for signed waivers—your IP address and browser user agent as a verification record.
              </li>
              <li>
                <strong>Technical &amp; security data:</strong> IP addresses and request metadata are processed transiently for rate limiting, abuse
                prevention, and Cloudflare Turnstile bot verification.
              </li>
            </ul>

            <h3>2. How we use your information</h3>
            <ul>
              <li>To schedule, confirm, reschedule, refund, and deliver your booked experiences and audio/mix deliverables.</li>
              <li>To send transactional emails (booking confirmations, calendar invites, 24-hour reminders, track delivery, and post-session review invites).</li>
              <li>To prevent double bookings across our studio calendars and detect fraud, spam, or automated abuse.</li>
              <li>To send occasional news, community meetup updates, or offers <strong>only if you opt in</strong>.</li>
            </ul>

            <h3>3. Service providers &amp; data sharing</h3>
            <p>
              <strong>We do not sell your personal information</strong> and do not share it with third parties for cross-context behavioral advertising.
              We share data only with the infrastructure providers needed to run our business:
            </p>
            <ul>
              <li>
                <strong>Stripe</strong> (payment processing and refunds)
              </li>
              <li>
                <strong>Resend</strong> (transactional and opted-in email delivery)
              </li>
              <li>
                <strong>Cloudflare Turnstile</strong> (bot and spam protection on public forms)
              </li>
              <li>
                <strong>Vercel &amp; Neon Postgres</strong> (website hosting and encrypted database storage)
              </li>
              <li>
                <strong>Google Calendar / Cal.com</strong> (scheduling and conflict sync so times are never double-booked)
              </li>
            </ul>
            <p>We may also disclose information if required by law, subpoena, or to protect the safety and legal rights of our guests and business.</p>

            <h3>4. Email marketing &amp; opt-out (CAN-SPAM)</h3>
            <p>
              Opting into promotional emails is never required to book a session. Every promotional email includes a working one-click unsubscribe link
              and our physical mailing address. Unsubscribing stops marketing emails immediately while keeping transactional booking messages active.
            </p>

            <h3>5. Data retention &amp; security</h3>
            <p>
              We retain booking, payment, and signed waiver records for as long as needed to deliver sessions, comply with tax/accounting obligations, and
              maintain legal records. Connections to our website and database use TLS encryption, administrative access is protected by signed HTTP-only
              sessions and rate-limited authentication, and guest manage/waiver/review links use unique cryptographic tokens.
            </p>

            <h3>6. Your privacy rights</h3>
            <p>
              Regardless of where you live, you may request to access, correct, export, or delete personal information we hold about you (subject to
              records we must keep for legal, tax, or signed waiver compliance), or opt out of marketing emails at any time by writing to{" "}
              <a href={`mailto:${BUSINESS.contactEmail}`} className="link">
                {BUSINESS.contactEmail}
              </a>
              . We will respond within 30 days.
            </p>

            <h3>7. Children&rsquo;s privacy</h3>
            <p>
              Our website and checkout are intended for adults aged 18 and older. While children aged 10+ may attend music production sessions with a
              parent or guardian, we do not knowingly collect personal information directly from children under 13 without parental involvement. If you
              believe a child under 13 submitted personal information directly, please contact us and we will promptly delete it.
            </p>
          </section>

          <section id="cookies" aria-labelledby="ck-title">
            <h2 id="ck-title">Cookie &amp; storage policy</h2>
            <p>
              We keep this website clean and lightweight. <strong>We do not use third-party advertising cookies, tracking pixels, or behavioral ad
              networks.</strong> Only strictly necessary cookies and security storage are used:
            </p>
            <div className={styles.tableWrap} role="region" aria-label="Cookies and browser storage used" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Technology</th>
                    <th scope="col">Purpose</th>
                    <th scope="col">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Cloudflare Turnstile</th>
                    <td>Protects booking, inquiry, waitlist, gift card, and RSVP forms from bots and automated spam.</td>
                    <td>Strictly necessary (security)</td>
                  </tr>
                  <tr>
                    <th scope="row">Stripe Checkout</th>
                    <td>Processes payments securely and prevents payment fraud when you are redirected to Stripe to pay.</td>
                    <td>Strictly necessary (payment, third-party domain)</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      <code>rp_admin</code> cookie
                    </th>
                    <td>Signed, HTTP-only authentication cookie set only when studio staff sign into the private admin dashboard. Never set for guests.</td>
                    <td>Strictly necessary (staff auth)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              You can configure your browser to block cookies at any time, though blocking strictly necessary security or payment cookies may prevent
              Cloudflare Turnstile or Stripe Checkout from completing your booking.
            </p>
          </section>

          <section id="accessibility" aria-labelledby="acc-title">
            <h2 id="acc-title">Accessibility statement</h2>
            <p>
              {BUSINESS.legalName} is committed to making our website and in-person studio experiences accessible to everyone. We aim to conform with the
              Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, including keyboard navigation, clear focus states, semantic headings, screen-reader
              labels, sufficient color contrast, and reduced-motion support.
            </p>
            <p>
              Because sessions take place in historic New York City buildings that may involve stairs or specific studio setups, please reach out before
              booking if you have mobility, sensory, or other accessibility needs—we will gladly provide details on each studio space and work with you on
              accommodations. If you encounter any barrier on this website, email{" "}
              <a href={`mailto:${BUSINESS.contactEmail}`} className="link">
                {BUSINESS.contactEmail}
              </a>{" "}
              and we will help you book directly and fix the issue.
            </p>
          </section>

          <section id="contact-legal" aria-labelledby="cl-title">
            <h2 id="cl-title">Business &amp; legal contact</h2>
            <p>For questions about these policies, privacy requests, accessibility assistance, or legal notices, contact:</p>
            <div className={styles.addressBox}>
              <p>
                <strong>{BUSINESS.legalName}</strong> (doing business as {BUSINESS.name})
              </p>
              {postalAddress ? <p>{postalAddress}</p> : <p>{BUSINESS.city}, USA</p>}
              <p>
                Email:{" "}
                <a href={`mailto:${BUSINESS.contactEmail}`} className="link">
                  {BUSINESS.contactEmail}
                </a>
                {hostPhone ? <> &middot; Phone: {hostPhone}</> : null}
              </p>
            </div>
            <p className={styles.updated}>
              Last updated: {LAST_UPDATED}. Have a question before you book?{" "}
              <Link href="/contact" className="link">
                Send us a message
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
