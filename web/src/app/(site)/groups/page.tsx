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
  title: "Private sessions & groups",
  description:
    "Book a completely private music production, DJ or meditation session in NYC at a premium rate, or plan a birthday, team event or corporate wellness day with us.",
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
  { t: "Send a request", d: "Which experience, who's coming and roughly when." },
  { t: "We confirm the details", d: "Alex replies with the date, timings and the price, usually within a day." },
  { t: "Lock it in", d: "Once it's confirmed, the session is yours alone." },
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
          { name: "Private sessions", path: "/groups" },
        ])}
      />
      <PageHeader
        crumbs={[{ name: "Private sessions & groups" }]}
        eyebrow="Private sessions & groups"
        title="Private sessions"
        lede="Our regular sessions are public and shared with other guests. If you'd like the room to yourselves, any experience can be booked as a completely private session at a premium rate."
        aside={
          <div className={styles.art}>
            <div className={styles.img}>
              <Image src={img.src} alt={img.alt} fill preload sizes="(max-width: 900px) 92vw, 460px" className={styles.cover} />
            </div>
          </div>
        }
      >
        <div className={styles.ctas}>
          <a href="#request" className="btn btn--accent">
            Request a private session
          </a>
          <Link href="/experiences" className="btn btn--ghost">
            See the experiences
          </Link>
        </div>
      </PageHeader>

      <section className={styles.rates} aria-labelledby="rates-title">
        <div className="wrap">
          <h2 id="rates-title" className={styles.h2}>
            Private session rates
          </h2>
          <ul className={styles.rateGrid}>
            {experiences.map((e) => {
              const cents = PRIVATE_SESSION_CENTS[e.theme];
              return (
                <li key={e.slug} data-theme={themeOf(e)}>
                  <h3>{e.name}</h3>
                  <p className={styles.rate}>{cents ? formatMoney(cents) : "Please reach out"}</p>
                  <p>{cents ? "Premium rate for a completely private session." : "Tell us about your group and we'll put a quote together."}</p>
                  <a href="#request" className="btn btn--sm">
                    {cents ? "Request this session" : "Ask for a quote"}
                    <span className="sr-only">: {e.name}</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <p className={styles.small}>For any private session or special request, we suggest reaching out first so we can confirm the date and details with you.</p>
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
              How it works
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
              Happy to share the room? Public sessions can be{" "}
              <Link href="/experiences" className="link">
                booked online
              </Link>{" "}
              right away, for one guest or a group.
            </p>
          </div>
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>Your request</h3>
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
