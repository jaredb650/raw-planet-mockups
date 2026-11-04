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
import { getActiveExperiences, getPublishedReviews } from "@/lib/queries/public";
import styles from "./groups.module.css";

export const metadata: Metadata = {
  title: "Groups, parties & team events",
  description:
    "Birthday parties, bachelorettes, team building and corporate wellness in NYC: private music production, DJ and group sound meditation sessions shaped around your group.",
  alternates: { canonical: "/groups" },
  openGraph: { url: "/groups" },
};

const OCCASIONS = [
  { t: "Birthdays", d: "Make a song for the birthday person, then play it back loud. Music production is open to ages 10 and up.", theme: "production" },
  { t: "Bachelorettes & nights out", d: "Take over the decks for a private DJ session, or record a ridiculous anthem together.", theme: "dj" },
  { t: "Team building", d: "Nobody needs to be musical. Teams split into roles, build one track and leave with something they made together.", theme: "production" },
  { t: "Corporate wellness", d: "A guided sound meditation for 10 or more: crystal bowls, live soundscapes and projected visuals.", theme: "wellness" },
];

const STEPS = [
  { t: "Tell us the plan", d: "Who's coming, roughly when, and what you're celebrating." },
  { t: "Alex shapes the session", d: "He replies with options, timings and a clear price for your group, usually within a day." },
  { t: "Lock it in", d: "Pay online in one go. The room is yours for the session." },
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
          { name: "Groups", path: "/groups" },
        ])}
      />
      <PageHeader
        crumbs={[{ name: "Groups & private events" }]}
        eyebrow="Groups, parties & team events"
        title="Bring the whole crew."
        lede="Birthdays, bachelorettes, team days and corporate wellness. Tell us what you're planning and Alex will shape the session around your group."
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
            Send a group request
          </a>
          <Link href="/experiences" className="btn btn--ghost">
            See the experiences
          </Link>
        </div>
      </PageHeader>

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
              Smaller group (up to 6)? You can{" "}
              <Link href="/experiences" className="link">
                book online
              </Link>{" "}
              right away.
            </p>
          </div>
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>Your group request</h3>
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
            <h2 id="gfaq-title">Group questions</h2>
            <FaqList items={faq} />
          </div>
        </section>
      ) : null}
    </>
  );
}
