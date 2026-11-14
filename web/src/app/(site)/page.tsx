import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EventCard } from "@/components/site/EventCard";
import { ExperienceRows } from "@/components/site/ExperienceRow";
import { FaqList } from "@/components/site/FaqList";
import { resolveFaq } from "@/components/site/faq";
import { HomeBooking } from "@/components/site/HomeBooking";
import { JsonLd } from "@/components/site/JsonLd";
import { meditationReel, SITE_MEDIA } from "@/components/site/media";
import { MoodProvider } from "@/components/site/MoodContext";
import { ReelPlayer } from "@/components/site/ReelPlayer";
import { ReviewCard } from "@/components/site/ReviewCard";
import { pullQuote } from "@/components/site/format";
import { businessJsonLd } from "@/components/site/schema";
import { Stars } from "@/components/site/Stars";
import { HOST, PRIVATE_SESSION_CENTS } from "@/content/site";
import { BUSINESS } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { getActiveExperiences, getPublishedReviews, getRatingSummary, getUpcomingEvents } from "@/lib/queries/public";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: { absolute: `${BUSINESS.name} · Music production, DJ & sound meditation in NYC` },
  description:
    "Music production, DJ and meditation experiences in New York City with producer Alex Gentil. Two hours, no experience needed, open to individual and group bookings.",
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const [experiences, rating, reviews, events] = await Promise.all([
    getActiveExperiences(),
    getRatingSummary(),
    getPublishedReviews({ limit: 12 }),
    getUpcomingEvents(3),
  ]);
  const requested = typeof sp.experience === "string" ? sp.experience : undefined;
  const requestedSlug = experiences.find((e) => e.slug === requested)?.slug;
  const initialSlug = requestedSlug ?? experiences[0]?.slug ?? "";
  const faq = resolveFaq(experiences).filter((f) => f.home);
  const [lead, ...rest] = reviews;
  const leadQuote = lead ? pullQuote(lead.body) : null;
  const quotes = rest.slice(0, 4);
  const nameBySlug = Object.fromEntries(experiences.map((e) => [e.slug, e.shortName]));
  const { heroMain, heroSnap, host } = SITE_MEDIA;
  const privateRates = experiences.filter((e) => PRIVATE_SESSION_CENTS[e.theme]);

  return (
    <MoodProvider items={experiences.map((e) => ({ slug: e.slug, theme: e.theme }))} initialSlug={initialSlug} initialPicked={Boolean(requestedSlug)}>
      <JsonLd data={businessJsonLd(rating, heroMain.src)} />

      {/* Hero */}
      <section data-band="navy" className={styles.hero} aria-labelledby="hero-title">
        <div className={`wrap ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span>Music experiences</span> <span className={styles.heroTitleAccent}>in New York City</span>
            </h1>
            <p className={`lede ${styles.heroLede}`}>
              Two hours in a real studio with a working producer. Produce a track, learn to DJ or join a guided sound meditation. No
              experience needed.
            </p>
            <div className={styles.heroCtas}>
              <a href="#experiences" className="btn btn--accent">
                See the experiences
              </a>
              <a href="#book" className="btn btn--ghost">
                See open times
              </a>
            </div>
            <dl className={styles.heroMeta}>
              <div>
                <dt className="sr-only">Rating</dt>
                <dd>
                  <strong className="tabular">{rating.score.toFixed(2)}</strong>
                  <Stars value={rating.score} size={14} />
                  <span>from {rating.count} ratings</span>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Length</dt>
                <dd>
                  <strong>2 hours</strong>
                  <span>every experience</span>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Languages</dt>
                <dd>
                  <strong>EN / ES</strong>
                  <span>hablamos español</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className={styles.heroArt}>
            <div className={styles.heroMain}>
              <Image
                src={heroMain.src}
                alt={heroMain.alt}
                fill
                preload
                sizes="(max-width: 980px) 92vw, 540px"
                className={styles.cover}
                style={{ objectPosition: "38% 50%" }}
              />
            </div>
            <div className={styles.snap}>
              <div className={styles.snapImg}>
                <Image src={heroSnap.src} alt={heroSnap.alt} fill sizes="(max-width: 600px) 46vw, 230px" className={styles.cover} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Experiences */}
      <section data-band="orange" className={styles.exps} id="experiences" aria-labelledby="exps-title">
        <div className="wrap">
          <div className={styles.expsHead}>
            <h2 id="exps-title">
              Our <span className="tt">experiences</span>
            </h2>
            <p className="lede">All sessions are public and open to individual and group bookings. Each one is 2 hours long.</p>
          </div>
          <ExperienceRows experiences={experiences} pickable />
        </div>
      </section>

      {/* Host */}
      <section data-band="blue" className={styles.host} id="alex" aria-labelledby="alex-title">
        <div className={`wrap ${styles.hostGrid}`}>
          <div className={styles.hostPhoto}>
            <div className={styles.hostImg}>
              <Image src={host.src} alt={host.alt} fill sizes="(max-width: 980px) 92vw, 560px" className={styles.cover} style={{ objectPosition: "28% 50%" }} />
            </div>
          </div>
          <div>
            <p className="eyebrow">Your host</p>
            <h2 id="alex-title" className={styles.hostTitle}>
              {HOST.intro}
            </h2>
            {HOST.paragraphs.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <dl className={styles.credits}>
              {HOST.credits.map((c) => (
                <div key={c.label}>
                  <dt>{c.label}</dt>
                  <dd>{c.value}</dd>
                </div>
              ))}
            </dl>
            <Link href="/about" className="link">
              More about Alex
            </Link>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section data-band="navy" className={styles.reviews} id="reviews" aria-labelledby="reviews-title">
        <div className="wrap">
          <div className={styles.head}>
            <div className={styles.reviewsTitle}>
              <h2 id="reviews-title">
                Guest <span className="tt">reviews</span>
              </h2>
              <Link href="/reviews" className="btn btn--ghost btn--sm">
                Read all reviews
              </Link>
            </div>
            <div className={styles.score}>
              <strong className="tabular">{rating.score.toFixed(2)}</strong>
              <span>
                <Stars value={rating.score} size={18} />
                <br />
                out of 5 from {rating.count} ratings
              </span>
            </div>
          </div>
          {lead && leadQuote ? (
            <figure className={styles.leadQuote}>
              <blockquote>
                <p>&ldquo;{leadQuote.text}&rdquo;</p>
              </blockquote>
              <figcaption>
                {lead.name}
                {lead.location ? <span>, {lead.location}</span> : null}
                {leadQuote.trimmed ? (
                  <>
                    {" "}
                    <Link href={`/reviews#review-${lead.id}`} className={`link ${styles.fullReview}`}>
                      Read the full review
                    </Link>
                  </>
                ) : null}
              </figcaption>
            </figure>
          ) : null}
          <div className={styles.reviewsGrid}>
            <div className={styles.quotes}>
              {quotes.map((r) => (
                <ReviewCard key={r.id} review={r} experienceName={r.experienceSlug ? nameBySlug[r.experienceSlug] : undefined} showStars={false} />
              ))}
            </div>
            {meditationReel ? (
              <div className={styles.reelCol} data-theme="wellness">
                <p className="eyebrow">Inside the meditation</p>
                <ReelPlayer video={meditationReel} title="Meditation Experience: a look inside a session" />
                <p className={styles.reelNote}>
                  A look inside the <Link href="/experiences/sound-meditation" className="link">Meditation Experience</Link>.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Booking */}
      <section data-band="green" className={styles.book} id="book" aria-labelledby="book-title">
        <div className="wrap">
          <div className={styles.head}>
            <div>
              <p className="eyebrow">Find your time</p>
              <h2 id="book-title">
                Book an <span className="tt">experience</span>
              </h2>
            </div>
            <p>Pick an experience, a day and a start time. You&rsquo;ll see the total before you pay, and you can move or cancel yourself from your confirmation email.</p>
          </div>
          <HomeBooking experiences={experiences} />
        </div>
      </section>

      {/* Gifts & groups */}
      <section data-band="sand" className={styles.extras} aria-label="Gift cards and groups">
        <div className={`wrap ${styles.extrasGrid}`}>
          <div className={`${styles.extra} ${styles.extraGift}`}>
            <div>
              <h3>Gift cards</h3>
              <p>A gift card for any of the experiences, used whenever suits them.</p>
              <ul className={styles.chips} aria-label="Gift card features">
                <li>Any experience</li>
                <li>Sent by email</li>
                <li>Pick the delivery day</li>
              </ul>
            </div>
            <Link href="/gift-cards" className="btn btn--light">
              Buy a gift card
            </Link>
          </div>
          <div className={`${styles.extra} ${styles.extraGroup}`}>
            <div>
              <h3>Private sessions</h3>
              <p>
                Want the room to yourselves? Any experience can be booked as a completely private session at a premium rate. Team outings,
                birthdays and company events are welcome too.
              </p>
              <ul className={styles.chips} aria-label="Private session rates">
                {privateRates.map((e) => (
                  <li key={e.slug}>
                    {e.shortName} {formatMoney(PRIVATE_SESSION_CENTS[e.theme])}
                  </li>
                ))}
                <li>Meditation: ask us</li>
              </ul>
            </div>
            <Link href="/groups" className="btn btn--light">
              Ask about a private session
            </Link>
          </div>
        </div>
      </section>

      {/* Community */}
      <section data-band="blue" className={styles.community} id="community" aria-labelledby="community-title">
        <div className={`wrap ${styles.communityGrid}`}>
          <div className={styles.communityIntro}>
            <p className="eyebrow">Community events &amp; meetups</p>
            <h2 id="community-title">
              Community <span className="tt">events</span>
            </h2>
            <p>
              Every three weeks we host a free meetup for electronic music producers, DJs and musicians at Mercy Sound Studios: production
              talk, live demos and track feedback. Beginners welcome.
            </p>
            <div className={styles.communityCtas}>
              <Link href="/events" className="btn">
                All events
              </Link>
              {BUSINESS.meetupGroupUrl ? (
                <a href={BUSINESS.meetupGroupUrl} className="btn btn--ghost" target="_blank" rel="noopener">
                  Join us on Meetup <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </div>
          </div>
          <div className={styles.eventList}>
            {events.length ? (
              events.map((ev) => <EventCard key={ev.id} ev={ev} compact />)
            ) : (
              <div className={styles.eventsEmpty}>
                <p>
                  <strong>The next meetup is being scheduled.</strong>
                </p>
                <p className="muted">
                  {BUSINESS.meetupGroupUrl ? "Follow the group on Meetup to hear first." : "Check back soon, or ask about it when you book."}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section data-band="orange" className={styles.faq} id="faq" aria-labelledby="faq-title">
        <div className={`wrap ${styles.faqGrid}`}>
          <div>
            <h2 id="faq-title">
              Questions <span className="tt">&amp; answers</span>
            </h2>
            <p className="muted">
              Can&rsquo;t find yours? <Link href="/faq" className="link">See all questions</Link> or{" "}
              <Link href="/contact" className="link">ask us</Link>.
            </p>
          </div>
          <FaqList items={faq} />
        </div>
      </section>
    </MoodProvider>
  );
}
