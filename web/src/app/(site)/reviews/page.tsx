import type { Metadata } from "next";
import Link from "next/link";
import { themeOf } from "@/components/site/format";
import { JsonLd } from "@/components/site/JsonLd";
import { meditationReel, productionReel, SITE_MEDIA } from "@/components/site/media";
import { PageHeader } from "@/components/site/PageHeader";
import { GuestVideo } from "@/components/site/GuestVideo";
import { ReelPlayer } from "@/components/site/ReelPlayer";
import { ReviewCard } from "@/components/site/ReviewCard";
import { breadcrumbJsonLd, businessJsonLd, reviewJsonLd } from "@/components/site/schema";
import { Stars } from "@/components/site/Stars";
import { BUSINESS } from "@/lib/config";
import { getActiveExperiences, getPublishedReviews, getRatingSummary } from "@/lib/queries/public";
import { videoEmbed } from "@/lib/video";
import styles from "./reviews.module.css";

export const metadata: Metadata = {
  title: "Reviews",
  description: `Rated ${BUSINESS.airbnbRating.score} out of 5 by guests. Read what people say about Raw Planet's music production, DJ and sound meditation sessions in NYC.`,
  alternates: { canonical: "/reviews" },
  openGraph: { url: "/reviews" },
};

const VIDEOS = [
  meditationReel && {
    video: meditationReel,
    theme: "wellness",
    title: "Inside a sound meditation",
    note: "Sound on. A real group session: crystal bowls, live soundscapes and projected visuals.",
  },
  productionReel && {
    video: productionReel,
    theme: "production",
    title: "A music production session",
    note: "Studio b-roll, Alex at the desk and real guest reviews on screen.",
  },
].filter(Boolean) as { video: NonNullable<typeof meditationReel>; theme: string; title: string; note: string }[];

export default async function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  const sp = await searchParams;
  const [experiences, rating, all] = await Promise.all([getActiveExperiences(), getRatingSummary(), getPublishedReviews({ limit: 200 })]);
  const filter = typeof sp.experience === "string" && experiences.some((e) => e.slug === sp.experience) ? sp.experience : null;
  const list = filter ? all.filter((r) => r.experienceSlug === filter) : all;
  const nameBySlug = Object.fromEntries(experiences.map((e) => [e.slug, e.shortName]));
  const counts = Object.fromEntries(experiences.map((e) => [e.slug, all.filter((r) => r.experienceSlug === e.slug).length]));
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: all.filter((r) => r.rating === s).length }));
  const maxN = Math.max(1, ...dist.map((d) => d.n));
  const guestVideos = all.filter((r) => videoEmbed(r.videoUrl));

  return (
    <>
      <JsonLd
        data={[
          { ...businessJsonLd(rating, SITE_MEDIA.heroMain.src), review: all.slice(0, 20).map(reviewJsonLd) },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Reviews", path: "/reviews" },
          ]),
        ]}
      />
      <PageHeader
        crumbs={[{ name: "Reviews" }]}
        title="Guests leave humming."
        tone="accent"
        lede="Real words from real guests: birthdays, first-timers, colleagues and couples who came in curious and left with a track."
        aside={
          <div className={styles.summary}>
            <div className={styles.score}>
              <strong className="tabular">{rating.score.toFixed(2)}</strong>
              <span>
                <Stars value={rating.score} size={20} label={`${rating.score.toFixed(2)} out of 5`} />
                <br />
                from {rating.count} ratings
              </span>
            </div>
            <ul className={styles.dist} aria-label="Rating breakdown of the reviews on this page">
              {dist.map((d) => (
                <li key={d.s}>
                  <span>{d.s}★</span>
                  <span className={styles.bar} aria-hidden="true">
                    <span style={{ width: `${(d.n / maxN) * 100}%` }} />
                  </span>
                  <span className="tabular">{d.n}</span>
                </li>
              ))}
            </ul>
            <p className={styles.source}>
              Includes {BUSINESS.airbnbRating.count} ratings from our Airbnb Experiences listing plus reviews from guests who booked here.
            </p>
          </div>
        }
      />

      {VIDEOS.length || guestVideos.length ? (
        <section className={styles.videos} aria-labelledby="videos-title">
          <div className="wrap">
            <h2 id="videos-title" className={styles.h2}>
              Watch, then decide
            </h2>
            <div className={styles.videoGrid}>
              {guestVideos.map((r) => (
                <figure key={r.id} className={styles.videoCard} data-theme={themeOf(experiences.find((e) => e.slug === r.experienceSlug) ?? { theme: "wellness" })}>
                  <GuestVideo url={r.videoUrl!} title={`${r.name}'s video review`} />
                  <figcaption>
                    <strong>
                      {r.name}
                      {r.experienceSlug && nameBySlug[r.experienceSlug] ? ` · ${nameBySlug[r.experienceSlug]}` : ""}
                    </strong>
                    <span>&ldquo;{r.body.length > 140 ? `${r.body.slice(0, 137).trimEnd()}…` : r.body}&rdquo;</span>
                  </figcaption>
                </figure>
              ))}
              {VIDEOS.map((v) => (
                <figure key={v.video.src} className={styles.videoCard} data-theme={v.theme}>
                  <ReelPlayer video={v.video} title={v.title} />
                  <figcaption>
                    <strong>{v.title}</strong>
                    <span>{v.note}</span>
                  </figcaption>
                </figure>
              ))}
              <div className={styles.videoAsk}>
                <h3>Been to a session?</h3>
                <p>
                  We&rsquo;d love a 30-second video about how it felt, especially after sound meditation. Film it on your phone and send it with your
                  review link, or reply to your thank-you email.
                </p>
                <Link href="/contact" className="btn btn--ghost btn--sm">
                  Share your story
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.listSection} id="all" aria-labelledby="list-title">
        <div className="wrap">
          <div className={styles.listHead}>
            <h2 id="list-title" className={styles.h2}>
              {filter ? `${nameBySlug[filter]} reviews` : "All reviews"}
            </h2>
            <nav aria-label="Filter reviews by experience">
              <ul className={styles.filters}>
                <li>
                  <Link href="/reviews#all" aria-current={!filter ? "page" : undefined}>
                    All <span>{all.length}</span>
                  </Link>
                </li>
                {experiences
                  .filter((e) => counts[e.slug])
                  .map((e) => (
                    <li key={e.slug} data-theme={themeOf(e)}>
                      <Link href={`/reviews?experience=${e.slug}#all`} aria-current={filter === e.slug ? "page" : undefined}>
                        {e.shortName} <span>{counts[e.slug]}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>
          </div>
          {list.length ? (
            <div className={styles.grid}>
              {list.map((r) => (
                <ReviewCard key={r.id} review={r} experienceName={r.experienceSlug ? nameBySlug[r.experienceSlug] : undefined} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No reviews for this experience yet. <Link href="/reviews#all" className="link">See all reviews</Link>.
            </p>
          )}
        </div>
      </section>

      <section className={styles.cta} aria-labelledby="cta-title">
        <div className={`wrap ${styles.ctaGrid}`}>
          <h2 id="cta-title">Your turn.</h2>
          <p>Private sessions, no experience needed. Pick a room and a time.</p>
          <Link href="/experiences" className="btn btn--light">
            Find your session
          </Link>
        </div>
      </section>
    </>
  );
}
