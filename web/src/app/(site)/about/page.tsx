import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cardPhotoFor, SITE_MEDIA } from "@/components/site/media";
import { JsonLd } from "@/components/site/JsonLd";
import { themeOf } from "@/components/site/format";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { Stars } from "@/components/site/Stars";
import { HOST, MOODS } from "@/content/site";
import { BUSINESS, siteUrl } from "@/lib/config";
import { getActiveExperiences, getPublishedReviews, getRatingSummary } from "@/lib/queries/public";
import { Breadcrumbs } from "@/components/site/PageHeader";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About Alex",
  description:
    "Alex Gentil is a New York DJ, producer and audio engineer from Colombia with more than ten years in the studio. He hosts every Raw Planet session, in English or Spanish.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about", type: "profile" },
};

export default async function AboutPage() {
  const [experiences, rating, reviews] = await Promise.all([getActiveExperiences(), getRatingSummary(), getPublishedReviews({ limit: 60 })]);
  const aboutAlex = reviews.filter((r) => /alex|cristian|host/i.test(r.body) && r.body.length < 260).slice(0, 3);
  const portrait = SITE_MEDIA.host;
  const second = SITE_MEDIA.hostAlt;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Alexander Gentil",
            alternateName: ["Alex Gentil", "Cristian"],
            jobTitle: "DJ, music producer and audio engineer",
            image: siteUrl(portrait.src),
            url: siteUrl("/about"),
            knowsLanguage: ["en", "es"],
            sameAs: [BUSINESS.instagram, BUSINESS.soundcloud, BUSINESS.facebook, BUSINESS.website],
            worksFor: { "@type": "Organization", name: BUSINESS.name, url: siteUrl("/") },
          },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />

      <section className={styles.hero} aria-labelledby="about-title">
        <div className={`wrap ${styles.heroGrid}`}>
          <div>
            <Breadcrumbs crumbs={[{ name: "About" }]} />
            <p className="eyebrow">Your host</p>
            <h1 id="about-title" className={styles.title}>
              {HOST.intro}
            </h1>
            {HOST.paragraphs.map((p) => (
              <p key={p.slice(0, 20)} className={styles.para}>
                {p}
              </p>
            ))}
            <div className={styles.rating}>
              <strong className="tabular">{rating.score.toFixed(2)}</strong>
              <span>
                <Stars value={rating.score} size={16} />
                <br />
                from {rating.count} guest ratings
              </span>
            </div>
          </div>
          <div className={styles.photos}>
            <div className={styles.photoMain}>
              <Image src={portrait.src} alt={portrait.alt} fill preload sizes="(max-width: 900px) 80vw, 420px" className={styles.cover} style={{ objectPosition: "28% 40%" }} />
            </div>
            {second ? (
              <div className={styles.photoSmall}>
                <Image src={second.src} alt={second.alt} fill sizes="(max-width: 900px) 40vw, 220px" className={styles.cover} />
              </div>
            ) : null}
            <div className={styles.sticker} aria-hidden="true">
              Hablamos español
            </div>
          </div>
        </div>
      </section>

      <section className={styles.credits} aria-labelledby="credits-title">
        <div className="wrap">
          <h2 id="credits-title" className="sr-only">
            Background
          </h2>
          <dl className={styles.creditGrid}>
            <div>
              <dt>Years in the studio</dt>
              <dd>10+</dd>
            </div>
            {HOST.credits.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={styles.why} aria-labelledby="why-title">
        <div className={`wrap ${styles.whyGrid}`}>
          <h2 id="why-title">Why Raw Planet?</h2>
          <div>
            <p className="lede">
              Most people never get to stand in a real studio and hear their own idea come out of the big speakers. Raw Planet exists to make that easy:
              private sessions, no jargon, and a host who has spent a career making other people sound good.
            </p>
            <p>
              Sessions are private, so it&rsquo;s just you and your people. You don&rsquo;t need to sing, play an instrument or know any software. Alex
              handles the technical side, so you can focus on the fun part.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.rooms} aria-labelledby="rooms-title">
        <div className="wrap">
          <h2 id="rooms-title" className={styles.h2}>
            Three ways to work with Alex
          </h2>
          <div className={styles.roomGrid}>
            {experiences.map((e) => {
              const t = themeOf(e);
              const ph = cardPhotoFor(t);
              return (
                <Link key={e.slug} href={`/experiences/${e.slug}`} className={styles.room} data-theme={t}>
                  <div className={styles.roomImg}>
                    <Image src={ph.src} alt="" fill sizes="(max-width: 900px) 92vw, 380px" className={styles.cover} />
                  </div>
                  <span className={styles.roomLabel}>{MOODS[t]?.label ?? e.shortName}</span>
                  <strong>{e.shortName}</strong>
                  <span className="muted">{e.tagline}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {aboutAlex.length ? (
        <section className={styles.quotes} aria-labelledby="quotes-title">
          <div className="wrap">
            <h2 id="quotes-title" className={styles.h2}>
              What guests say about Alex
            </h2>
            <div className={styles.quoteGrid}>
              {aboutAlex.map((r) => (
                <figure key={r.id} className={styles.quote}>
                  <blockquote>
                    <p>&ldquo;{r.body}&rdquo;</p>
                  </blockquote>
                  <figcaption>
                    {r.name}
                    {r.location ? <span>, {r.location}</span> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
            <Link href="/reviews" className="btn btn--ghost">
              Read all reviews
            </Link>
          </div>
        </section>
      ) : null}

      <section className={styles.follow} aria-labelledby="follow-title">
        <div className={`wrap ${styles.followGrid}`}>
          <h2 id="follow-title">Hear more.</h2>
          <ul className={styles.links}>
            <li>
              <a href={BUSINESS.soundcloud} target="_blank" rel="noopener">
                SoundCloud <span aria-hidden="true">↗</span>
              </a>
            </li>
            <li>
              <a href={BUSINESS.instagram} target="_blank" rel="noopener">
                Instagram <span aria-hidden="true">↗</span>
              </a>
            </li>
            <li>
              <a href={BUSINESS.website} target="_blank" rel="noopener">
                alexandergentil.net <span aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
          <Link href="/experiences" className="btn btn--light">
            Book a session with Alex
          </Link>
        </div>
      </section>
    </>
  );
}
