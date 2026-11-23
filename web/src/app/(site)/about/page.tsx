import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cardPhotoFor, SITE_MEDIA } from "@/components/site/media";
import { JsonLd } from "@/components/site/JsonLd";
import { priceLabel, themeOf } from "@/components/site/format";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { Stars } from "@/components/site/Stars";
import { COHOSTS, HOST } from "@/content/site";
import { BUSINESS, siteUrl } from "@/lib/config";
import { getActiveExperiences, getPublishedReviews, getRatingSummary } from "@/lib/queries/public";
import { Breadcrumbs } from "@/components/site/PageHeader";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About Alex",
  description:
    "Alex Gentil is a New York DJ, producer and audio engineer from Colombia with more than ten years in the studio. He leads every Raw Planet experience, in English or Spanish.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about", type: "profile" },
};

export default async function AboutPage() {
  const [experiences, rating, reviews] = await Promise.all([getActiveExperiences(), getRatingSummary(), getPublishedReviews({ limit: 60 })]);
  const aboutAlex = reviews.filter((r) => /alex|cristian|host/i.test(r.body) && r.body.length < 260).slice(0, 3);
  const portrait = SITE_MEDIA.host;
  const second = SITE_MEDIA.hostAlt;
  const coHosted = experiences.filter((e) => COHOSTS[e.theme]?.count);

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

      {coHosted.length ? (
        <section className={styles.team} aria-labelledby="team-title">
          <div className={`wrap ${styles.whyGrid}`}>
            <h2 id="team-title">Co-hosts</h2>
            <div>
              <ul className={styles.teamList}>
                {coHosted.map((e) => {
                  const { count, people } = COHOSTS[e.theme];
                  return (
                    <li key={e.slug}>
                      <strong>{e.name}</strong>
                      <span>
                        Alex is joined by {count === 1 ? "one co-host" : count === 2 ? "two co-hosts" : `${count} co-hosts`}
                        {people.length ? `: ${people.map((p) => p.name).join(" and ")}` : ""}.
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className={styles.teamGrid}>
                {coHosted.flatMap((e) =>
                  COHOSTS[e.theme].people.map((p) => {
                    const bioParagraphs = p.paragraphs?.length ? p.paragraphs : [p.bio];
                    return (
                      <article key={`${e.slug}-${p.name}`} className={styles.teamCard}>
                        <div className={p.photo ? styles.teamImg : styles.teamAvatar}>
                          {p.photo ? (
                            <Image
                              src={p.photo.src}
                              alt={p.photo.alt}
                              fill
                              sizes="(max-width: 720px) 88vw, 220px"
                              className={styles.cover}
                              style={p.photo.objectPosition ? { objectPosition: p.photo.objectPosition } : undefined}
                            />
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden className={styles.teamBlank}>
                              <circle cx="12" cy="8.5" r="4" />
                              <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" />
                            </svg>
                          )}
                        </div>
                        <div className={styles.teamBody}>
                          <p className="eyebrow">{e.name}</p>
                          <h3>{p.name}</h3>
                          {p.role ? <p className={styles.teamRole}>{p.role}</p> : null}
                          <div className={styles.teamBio}>
                            {bioParagraphs.map((para) => (
                              <p key={para.slice(0, 28)}>{para}</p>
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  }),
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.why} aria-labelledby="why-title">
        <div className={`wrap ${styles.whyGrid}`}>
          <h2 id="why-title">Why Raw Planet?</h2>
          <div>
            <p className="lede">
              Most people never get to stand in a real studio and hear their own idea come out of the big speakers. Raw Planet exists to make that easy:
              no jargon, and a host who has spent a career making other people sound good.
            </p>
            <p>
              Sessions are open to individual and group bookings. You don&rsquo;t need to sing, play an instrument or know any software. Alex
              handles the technical side, so you can focus on the fun part.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.rooms} aria-labelledby="rooms-title">
        <div className="wrap">
          <h2 id="rooms-title" className={styles.h2}>
            The experiences
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
                  <strong>{e.name}</strong>
                  <span className="muted">
                    {priceLabel(e)} · {e.locationArea}
                  </span>
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
                    {r.sourceUrl ? (
                      <>
                        {" · "}
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Read on Airbnb<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </>
                    ) : null}
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
          <h2 id="follow-title">Listen and follow</h2>
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
