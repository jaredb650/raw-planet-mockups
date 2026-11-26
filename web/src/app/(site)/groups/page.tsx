import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FaqList } from "@/components/site/FaqList";
import { resolveFaq } from "@/components/site/faq";
import { InquiryForm } from "@/components/site/InquiryForm";
import { JsonLd } from "@/components/site/JsonLd";
import { SITE_MEDIA } from "@/components/site/media";
import { PageHeader } from "@/components/site/PageHeader";
import { ReviewCard } from "@/components/site/ReviewCard";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { PRIVATE_SESSION_CENTS } from "@/content/site";
import { formatMoney } from "@/lib/money";
import { themeOf } from "@/components/site/format";
import { getActiveExperiences, getPublishedReviews } from "@/lib/queries/public";
import styles from "./groups.module.css";

export const metadata: Metadata = {
  title: "Groups & custom inquiries",
  description:
    "Book a private music production, DJ or meditation session directly online, or send a custom inquiry for corporate events, birthdays, larger groups and special setups in NYC.",
  alternates: { canonical: "/groups" },
  openGraph: { url: "/groups" },
};

const OCCASIONS = [
  { t: "Birthdays", d: "Make a song for the birthday person, then play it back loud. Music production is open to ages 10 and up.", theme: "production" },
  { t: "Bachelorettes & nights out", d: "Learn to DJ together and record your own mix, or produce a song as a group.", theme: "dj" },
  { t: "Team building", d: "Nobody needs to be musical. Teams split into roles, build one track and leave with something they made together.", theme: "production" },
  { t: "Corporate wellness", d: "A guided sound meditation for your team: crystal bowls, live soundscapes and projected visuals.", theme: "wellness" },
];

const STEPS = [
  { t: "Tell us what you have in mind", d: "Share your group size, occasion, rough dates and any custom requests." },
  { t: "We put together a plan", d: "Alex replies with availability, custom options and pricing — usually within a day." },
  { t: "Lock it in", d: "Once everything looks good, we reserve the studio for your event." },
];

const GROUP_WORDS = /group|colleague|team|birthday|friends|party|bachelor/i;

export default async function GroupsPage({ searchParams }: PageProps<"/groups">) {
  const sp = await searchParams;
  const [experiences, reviews] = await Promise.all([getActiveExperiences(), getPublishedReviews({ limit: 60 })]);
  const requested = typeof sp.experience === "string" ? sp.experience : undefined;
  const initialExperience = experiences.some((e) => e.slug === requested) ? requested : undefined;
  const groupReviews = reviews.filter((r) => GROUP_WORDS.test(r.body)).slice(0, 3);
  const faq = resolveFaq(experiences).filter((f) => f.category === "groups");
  const img = SITE_MEDIA.groups;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Groups & inquiries", path: "/groups" },
        ])}
      />
      <PageHeader
        crumbs={[{ name: "Groups & custom inquiries" }]}
        eyebrow="Groups & custom inquiries"
        title="Custom events & groups"
        lede="Need a private session for your group? You can book any experience privately right on our calendar. Planning a corporate event, bigger group, or something custom? Reach out below and we'll put it together with you."
        aside={
          <div className={styles.art}>
            <div className={styles.img}>
              <Image src={img.src} alt={img.alt} fill preload sizes="(max-width: 900px) 92vw, 460px" className={styles.cover} />
            </div>
          </div>
        }
      >
        <div className={styles.ctas}>
          <Link href="/book?private=1" className="btn btn--accent">
            Book a private session
          </Link>
          <a href="#request" className="btn btn--ghost">
            Send a custom inquiry
          </a>
        </div>
      </PageHeader>

      <section className={styles.rates} aria-labelledby="rates-title">
        <div className="wrap">
          <h2 id="rates-title" className={styles.h2}>
            Book a private session online
          </h2>
          <ul className={styles.rateGrid}>
            {experiences.map((e) => {
              const cents = e.meta ? e.meta.privateRateCents : (PRIVATE_SESSION_CENTS[e.theme] ?? null);
              return (
                <li key={e.slug} data-theme={themeOf(e)}>
                  <h3>{e.name}</h3>
                  <p className={styles.rate}>{cents ? `From ${formatMoney(cents)}` : "Custom quote"}</p>
                  <p>
                    {cents
                      ? `Private buyout minimum for up to ${e.maxGuests} guests. Reserves the entire slot exclusively.`
                      : "Tell us about your group and we'll put a quote together."}
                  </p>
                  {cents ? (
                    <Link href={`/book/${e.slug}?private=1`} className="btn btn--sm">
                      Book private online
                      <span className="sr-only">: {e.name}</span>
                    </Link>
                  ) : (
                    <a href="#request" className="btn btn--sm">
                      Ask for a quote
                      <span className="sr-only">: {e.name}</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <p className={styles.small}>
            Private bookings reserve the whole time slot exclusively for your group (if your group&rsquo;s standard per-person total is higher than
            the buyout minimum, standard per-person pricing applies). Need more guests, custom hours, or an off-site event? Use the inquiry form below.
          </p>
        </div>
      </section>

      <section className={styles.occasions} aria-labelledby="occ-title">
        <div className="wrap">
          <h2 id="occ-title" className={styles.h2}>
            Made for
          </h2>
          <ul className={styles.occGrid}>
            {OCCASIONS.map((o) => (
              <li key={o.t} data-theme={o.theme}>
                <h3>{o.t}</h3>
                <p>{o.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.request} id="request" aria-labelledby="req-title">
        <div className={`wrap ${styles.reqGrid}`}>
          <div className={styles.reqIntro}>
            <h2 id="req-title" className={styles.h2}>
              Custom &amp; corporate inquiries
            </h2>
            <ol className={styles.steps}>
              {STEPS.map((s, i) => (
                <li key={s.t}>
                  <span className={styles.num} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <strong>{s.t}</strong>
                    <p>{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className={styles.small}>
              Ready to pick a time now? Both shared and private sessions can be{" "}
              <Link href="/book" className="link">
                booked directly online
              </Link>
              .
            </p>
          </div>
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>Send an inquiry</h3>
            <InquiryForm variant="group" experiences={experiences.map((e) => ({ slug: e.slug, shortName: e.shortName }))} initialExperience={initialExperience} />
          </div>
        </div>
      </section>

      {groupReviews.length ? (
        <section className={styles.reviews} aria-labelledby="gr-title">
          <div className="wrap">
            <h2 id="gr-title" className={styles.h2}>
              Groups who came before
            </h2>
            <div className={styles.reviewGrid}>
              {groupReviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {faq.length ? (
        <section className={styles.faq} aria-labelledby="gfaq-title">
          <div className={`wrap ${styles.faqGrid}`}>
            <h2 id="gfaq-title">Questions</h2>
            <FaqList items={faq} />
          </div>
        </section>
      ) : null}
    </>
  );
}
