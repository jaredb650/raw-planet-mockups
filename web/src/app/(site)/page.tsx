import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EventCard } from "@/components/site/EventCard";
import { ExperienceRow } from "@/components/site/ExperienceRow";
import { FaqList } from "@/components/site/FaqList";
import { resolveFaq } from "@/components/site/faq";
import { HomeBooking } from "@/components/site/HomeBooking";
import { JsonLd } from "@/components/site/JsonLd";
import { meditationReel, SITE_MEDIA } from "@/components/site/media";
import { MoodChooser } from "@/components/site/MoodChooser";
import { MoodProvider } from "@/components/site/MoodContext";
import { ReelPlayer } from "@/components/site/ReelPlayer";
import { ReviewCard } from "@/components/site/ReviewCard";
import { pullQuote } from "@/components/site/format";
import { businessJsonLd } from "@/components/site/schema";
import { Stars } from "@/components/site/Stars";
import { HOST, SLOGANS, WORRIES } from "@/content/site";
import { BUSINESS } from "@/lib/config";
import { getActiveExperiences, getPublishedReviews, getRatingSummary, getUpcomingEvents } from "@/lib/queries/public";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: { absolute: `${BUSINESS.name} · Music production, DJ & sound meditation in NYC` },
  description:
    "Private music production, DJ and sound meditation sessions in New York City with producer Alex Gentil. No experience needed. Make a track, play your first set, or slow down to the beat.",
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

  return (
    <MoodProvider items={experiences.map((e) => ({ slug: e.slug, theme: e.theme }))} initialSlug={initialSlug} initialPicked={Boolean(requestedSlug)}>
      <JsonLd data={businessJsonLd(rating, heroMain.src)} />

      {/* Hero */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`wrap ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.heroKicker}>
              <span className={styles.liveDot} aria-hidden="true" /> Private sessions in New York City
            </p>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span>Make it loud.</span> <span className={styles.heroTitleAccent}>Make it yours.</span>
            </h1>
            <p className={`lede ${styles.heroLede}`}>
              Two hours in a real studio with a working producer. Build a beat, mix your first DJ set, or lie back inside the sound. You
              don&rsquo;t need to know anything. Really.
            </p>
            <div className={styles.heroCtas}>
              <a href="#mood" className="btn btn--accent">
                Help me choose
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
                <dt className="sr-only">Experiences</dt>
                <dd>
                  <strong>{experiences.length} ways in</strong>
                  <span>production, DJ, sound</span>
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
            <div className={styles.heroSticker} aria-hidden="true">
              No experience needed
            </div>
            <figure className={styles.snap}>
              <div className={styles.snapImg}>
                <Image src={heroSnap.src} alt={heroSnap.alt} fill sizes="(max-width: 600px) 46vw, 230px" className={styles.cover} />
              </div>
              <figcaption>Your voice, on your track</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Mood chooser */}
      <section className={styles.mood} id="mood" aria-labelledby="mood-title">
        <div className="wrap">
          <div className={styles.head}>
            <h2 id="mood-title">What are you in the mood for?</h2>
            <p>Tap one. We&rsquo;ll set it up below.</p>
          </div>
          <MoodChooser
            items={experiences.map((e) => ({ slug: e.slug, theme: e.theme, shortName: e.shortName, locationArea: e.locationArea }))}
          />
        </div>
      </section>

      {/* Experiences */}
      <section className={styles.exps} id="experiences" aria-labelledby="exps-title">
        <div className="wrap">
          <div className={styles.expsHead}>
            <h2 id="exps-title">
              <span className={styles.line}>Three rooms.</span> <span className={styles.line}>Three ways in.</span>
            </h2>
            <p className="lede">Every session is private: just you, your people and Alex. Pick the room that fits the mood.</p>
          </div>
          {experiences.map((e, i) => (
            <ExperienceRow key={e.slug} e={e} index={i} pickable />
          ))}
        </div>
      </section>

      {/* Worries */}
      <section className={styles.worries} aria-labelledby="worries-title">
        <div className={`wrap ${styles.worriesGrid}`}>
          <div className={styles.worriesIntro}>
            <h2 id="worries-title">&ldquo;But I&rsquo;m not musical.&rdquo;</h2>
            <p className="lede">That&rsquo;s who most of our guests are. Here&rsquo;s what people worry about before they come, and what actually happens.</p>
          </div>
          <ul className={styles.worryList}>
            {WORRIES.map((w) => (
              <li key={w.worry}>
                <b>{w.worry}</b>
                <span>{w.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Host */}
      <section className={styles.host} id="alex" aria-labelledby="alex-title">
        <div className={`wrap ${styles.hostGrid}`}>
          <div className={styles.hostPhoto}>
            <div className={styles.hostImg}>
              <Image src={host.src} alt={host.alt} fill sizes="(max-width: 980px) 92vw, 560px" className={styles.cover} style={{ objectPosition: "28% 50%" }} />
            </div>
            <div className={styles.hostSticker} aria-hidden="true">
              Hablamos español
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
      <section className={styles.reviews} id="reviews" aria-labelledby="reviews-title">
        <div className="wrap">
          <div className={styles.head}>
            <div className={styles.reviewsTitle}>
              <h2 id="reviews-title">Guests leave humming.</h2>
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
                <p className="eyebrow">Inside the sound room</p>
                <ReelPlayer video={meditationReel} title="Sound meditation: a look inside a session" />
                <p className={styles.reelNote}>
                  {SLOGANS.wellness} <Link href="/experiences/sound-meditation" className="link">Sound meditation</Link> for groups of 10 or more.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Booking */}
      <section className={styles.book} id="book" aria-labelledby="book-title">
        <div className="wrap">
          <div className={styles.head}>
            <div>
              <p className="eyebrow">Find your time</p>
              <h2 id="book-title">{SLOGANS.booking}</h2>
            </div>
            <p>Pick a room, a day and a start time. You&rsquo;ll see the total before you pay, and you can move or cancel yourself from your confirmation email.</p>
          </div>
          <HomeBooking experiences={experiences} />
        </div>
      </section>

      {/* Gifts & groups */}
      <section className={styles.extras} aria-label="Gift cards and groups">
        <div className={`wrap ${styles.extrasGrid}`}>
          <div className={`${styles.extra} ${styles.extraGift}`}>
            <div>
              <h3>Give someone a song</h3>
              <p>A gift card for any of the experiences, used whenever suits them. Birthdays, anniversaries, the friend who has everything.</p>
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
              <h3>Bring the whole crew</h3>
              <p>Team outings, bachelorette parties, birthday groups, corporate wellness days. Tell us what you&rsquo;re planning and we&rsquo;ll shape the session around your group.</p>
              <ul className={styles.chips} aria-label="Group options">
                <li>Birthdays</li>
                <li>Teams</li>
                <li>Sound baths for 10+</li>
              </ul>
            </div>
            <Link href="/groups" className="btn btn--light">
              Plan a group session
            </Link>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className={styles.community} id="community" aria-labelledby="community-title">
        <div className={`wrap ${styles.communityGrid}`}>
          <div className={styles.communityIntro}>
            <p className="eyebrow">Community events &amp; meetups</p>
            <h2 id="community-title">Come hang out between sessions.</h2>
            <p>
              Every other week we get together with people making music in New York: listening sessions, feedback circles and good
              company. Beginners very welcome.
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
      <section className={styles.faq} id="faq" aria-labelledby="faq-title">
        <div className={`wrap ${styles.faqGrid}`}>
          <div>
            <h2 id="faq-title">Good questions</h2>
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
