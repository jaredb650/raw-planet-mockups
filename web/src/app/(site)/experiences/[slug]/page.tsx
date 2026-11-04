import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingSlot } from "@/components/site/BookingSlot";
import { FaqList } from "@/components/site/FaqList";
import { resolveFaq } from "@/components/site/faq";
import { ageLabel, durationLabel, groupLabel, priceLabel, priceUnit, themeOf } from "@/components/site/format";
import { Gallery } from "@/components/site/Gallery";
import { JsonLd } from "@/components/site/JsonLd";
import { cardPhotoFor, photosFor, reelFor, SITE_MEDIA } from "@/components/site/media";
import { getExperienceRating } from "@/components/site/queries";
import { ReelPlayer } from "@/components/site/ReelPlayer";
import { ReviewCard } from "@/components/site/ReviewCard";
import { breadcrumbJsonLd, experienceJsonLd } from "@/components/site/schema";
import { RatingBadge } from "@/components/site/Stars";
import { StickyBookBar } from "@/components/site/StickyBookBar";
import { EXPERIENCE_FAQ, HOST, MOODS, PERFECT_FOR, SESSION_FLOW_TITLE, SLOGANS } from "@/content/site";
import { BUSINESS } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { getActiveExperiences, getPublishedReviews, getRatingSummary } from "@/lib/queries/public";
import { fmtDuration } from "@/lib/time";
import { Breadcrumbs } from "@/components/site/PageHeader";
import styles from "./experience.module.css";

export async function generateMetadata({ params }: PageProps<"/experiences/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = (await getActiveExperiences()).find((x) => x.slug === slug);
  if (!e) return { title: "Experience not found" };
  const photo = cardPhotoFor(themeOf(e));
  return {
    title: `${e.name} in NYC`,
    description: `${e.summary} ${priceLabel(e)}. ${durationLabel(e)}. Hosted by ${BUSINESS.host}.`.slice(0, 300),
    alternates: { canonical: `/experiences/${e.slug}` },
    openGraph: { url: `/experiences/${e.slug}`, title: `${e.name} · ${BUSINESS.shortName}`, images: [{ url: photo.src, alt: photo.alt }] },
  };
}

export default async function ExperiencePage({ params }: PageProps<"/experiences/[slug]">) {
  const { slug } = await params;
  const experiences = await getActiveExperiences();
  const e = experiences.find((x) => x.slug === slug);
  if (!e) notFound();

  const theme = themeOf(e);
  const [ownRating, overall, ownReviews] = await Promise.all([
    getExperienceRating(e.id),
    getRatingSummary(),
    getPublishedReviews({ experienceId: e.id, limit: 6 }),
  ]);
  // The Airbnb aggregate (107 ratings) belongs to music production, the original listing.
  const rating = theme === "production" ? overall : ownRating;
  const otherReviews = ownReviews.length ? [] : await getPublishedReviews({ limit: 3 });
  const photos = photosFor(e);
  const reel = reelFor(theme);
  const faqWanted = EXPERIENCE_FAQ[theme] ?? [];
  const faq = resolveFaq(experiences).filter((f) => faqWanted.includes(f.q));
  faq.sort((a, b) => faqWanted.indexOf(a.q) - faqWanted.indexOf(b.q));
  const others = experiences.filter((x) => x.slug !== e.slug);
  const isGroupOnly = e.minGuests >= 5;
  const paragraphs = (e.description || e.summary).split(/\n{2,}/).filter(Boolean);
  const age = ageLabel(e);
  const sortedOptions = [...e.durationOptions].sort((a, b) => a.minutes - b.minutes);
  const nameBySlug = Object.fromEntries(experiences.map((x) => [x.slug, x.shortName]));

  const facts: { k: string; v: string; ph?: boolean }[] = [
    { k: "Length", v: durationLabel(e), ph: e.isPlaceholder },
    { k: "Group", v: groupLabel(e) },
    ...(age ? [{ k: "Ages", v: age.replace("Ages ", "") }] : []),
    { k: "Where", v: e.locationArea },
    { k: "Language", v: "English or Spanish" },
  ];

  return (
    <div data-theme={theme} className={styles.page}>
      <JsonLd
        data={[
          experienceJsonLd(e, { images: photos.slice(0, 5).map((p) => p.src), rating, reviews: ownReviews }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Experiences", path: "/experiences" },
            { name: e.shortName, path: `/experiences/${e.slug}` },
          ]),
        ]}
      />

      {/* Title + gallery */}
      <section className={styles.top} aria-labelledby="exp-title">
        <div className="wrap">
          <Breadcrumbs crumbs={[{ name: "Experiences", href: "/experiences" }, { name: e.shortName }]} />
          <div className={styles.titleRow}>
            <div>
              <p className={styles.kicker}>
                <span className={styles.swatch} aria-hidden="true" /> {e.name}
              </p>
              <h1 id="exp-title" className={styles.title}>
                {e.tagline || e.name}
              </h1>
            </div>
            <div className={styles.titleMeta}>
              {rating ? (
                <a href="#reviews" className={styles.ratingLink}>
                  <RatingBadge score={rating.score} count={rating.count} />
                </a>
              ) : (
                <span className={styles.newBadge}>New on the site</span>
              )}
              <span className={styles.area}>{e.locationArea}</span>
            </div>
          </div>
          <Gallery photos={photos} title={e.name} />
        </div>
      </section>

      {/* Body + sticky price box */}
      <div className={`wrap ${styles.layout}`}>
        <div className={styles.main}>
          <section className={styles.block} aria-labelledby="about-title">
            <h2 id="about-title" className="sr-only">
              About the {e.shortName.toLowerCase()} session
            </h2>
            <p className={styles.summary}>{e.summary}</p>
            <dl className={styles.facts}>
              {facts.map((f) => (
                <div key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>
                    {f.v} {f.ph ? <span className="tag-ph">details to confirm</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
            {paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </section>

          {e.highlights.length ? (
            <section className={styles.block} aria-labelledby="flow-title">
              <h2 id="flow-title" className={styles.h2}>
                {SESSION_FLOW_TITLE[theme] ?? "What you'll do"}
              </h2>
              <ol className={styles.flow}>
                {e.highlights.map((h, i) => (
                  <li key={h}>
                    <span className={styles.step} aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {reel ? (
            <section className={`${styles.block} ${styles.reelBlock}`} aria-labelledby="reel-title">
              <div className={styles.reelCopy}>
                <p className="eyebrow">{theme === "wellness" ? "Watch before you book" : "From the studio"}</p>
                <h2 id="reel-title" className={styles.h2}>
                  {theme === "wellness" ? "See and hear the room." : "Watch a session come together."}
                </h2>
                <p className="muted">
                  {theme === "wellness"
                    ? "Turn the sound on. This is a real session: crystal bowls, live soundscapes and projected visuals, filmed in the room."
                    : "Studio b-roll, Alex at the desk and what guests said afterwards, in under half a minute."}
                </p>
              </div>
              <div className={styles.reel}>
                <ReelPlayer video={reel} title={reel.alt} />
              </div>
            </section>
          ) : null}

          <section className={`${styles.block} ${styles.twoCol}`} aria-label="What's included and good to know">
            {e.includes.length ? (
              <div>
                <h2 className={styles.h3}>What&rsquo;s included</h2>
                <ul className={styles.ticks}>
                  {e.includes.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {e.goodToKnow.length ? (
              <div>
                <h2 className={styles.h3}>Good to know</h2>
                <ul className={styles.dots}>
                  {e.goodToKnow.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                  <li>
                    Free cancellation up to {e.cancellationHours} hours before. <Link href="/policies" className="link">Policies</Link>
                  </li>
                  <li>The exact address arrives with your confirmation.</li>
                </ul>
              </div>
            ) : null}
          </section>

          {PERFECT_FOR[theme] ? (
            <section className={styles.block} aria-labelledby="for-title">
              <h2 id="for-title" className={styles.h3}>
                Perfect for
              </h2>
              <ul className={styles.chips}>
                {PERFECT_FOR[theme].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {isGroupOnly ? (
                <p className={styles.groupNote}>
                  This one is for groups of {e.minGuests} or more.{" "}
                  <Link href={`/groups?experience=${e.slug}`} className="link">
                    Send a group request
                  </Link>{" "}
                  and we&rsquo;ll plan the date, the length and the room with you.
                </p>
              ) : null}
            </section>
          ) : null}

          <section className={`${styles.block} ${styles.host}`} aria-labelledby="host-title">
            <div className={styles.hostImg}>
              <Image src={SITE_MEDIA.host.src} alt={SITE_MEDIA.host.alt} fill sizes="120px" className={styles.cover} style={{ objectPosition: "28% 40%" }} />
            </div>
            <div>
              <p className="eyebrow">Your host</p>
              <h2 id="host-title" className={styles.h3}>
                {HOST.name}
              </h2>
              <p className="muted">{HOST.paragraphs[0]}</p>
              <Link href="/about" className="link">
                More about Alex
              </Link>
            </div>
          </section>
        </div>

        <aside className={styles.side} aria-label="Price and booking">
          <div className={styles.priceBox}>
            <p className={styles.priceLine}>
              <strong>{priceLabel(e).replace(/ per .*$/, "")}</strong>
              {e.isPlaceholder ? <span className="tag-ph">to confirm</span> : null}
            </p>
            <p className={styles.unit}>{priceUnit(e)}</p>
            {sortedOptions.length > 1 ? (
              <ul className={styles.options} aria-label="Session lengths">
                {sortedOptions.map((o) => (
                  <li key={o.minutes}>
                    <span>{fmtDuration(o.minutes)}</span>
                    <strong className="tabular">{formatMoney(o.priceCents)}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            <a href="#book" className="btn btn--accent btn--block">
              Check dates
            </a>
            <ul className={styles.assure}>
              <li>Free cancellation up to {e.cancellationHours}h before</li>
              <li>Move your booking yourself, online</li>
              <li>Pay securely; see the total before you pay</li>
            </ul>
            <p className={styles.giftLine}>
              <Link href="/gift-cards" className="link">
                Give it as a gift
              </Link>
              {isGroupOnly ? null : (
                <>
                  {" · "}
                  <Link href={`/groups?experience=${e.slug}`} className="link">
                    Bigger group?
                  </Link>
                </>
              )}
            </p>
          </div>
        </aside>
      </div>

      {/* Booking */}
      <section className={styles.book} id="book" aria-labelledby="book-title">
        <div className="wrap">
          <div className={styles.bookHead}>
            <div>
              <p className="eyebrow">Find your time</p>
              <h2 id="book-title">{isGroupOnly ? "Pick a date for your group." : SLOGANS.booking}</h2>
            </div>
            <p>
              Times are shown in New York time. You&rsquo;ll see the total before you pay, and you can move or cancel from your confirmation email.
            </p>
          </div>
          <BookingSlot experiences={experiences} initialSlug={e.slug} compact />
        </div>
      </section>

      {/* Reviews */}
      <section className={styles.reviews} id="reviews" aria-labelledby="reviews-title">
        <div className="wrap">
          <div className={styles.reviewsHead}>
            <h2 id="reviews-title">{ownReviews.length ? "What guests say" : "From Alex’s other sessions"}</h2>
            {rating ? <RatingBadge score={rating.score} count={rating.count} /> : null}
          </div>
          {!ownReviews.length ? (
            <p className="muted">
              {e.shortName} reviews will show up here after the first sessions booked on this site. Here&rsquo;s what guests said about Alex&rsquo;s
              music production sessions.
            </p>
          ) : null}
          <div className={styles.reviewGrid}>
            {(ownReviews.length ? ownReviews : otherReviews).map((r) => (
              <ReviewCard key={r.id} review={r} experienceName={r.experienceSlug ? nameBySlug[r.experienceSlug] : undefined} />
            ))}
          </div>
          <Link href={ownReviews.length ? `/reviews?experience=${e.slug}` : "/reviews"} className="btn btn--ghost">
            Read all reviews
          </Link>
        </div>
      </section>

      {/* FAQ */}
      {faq.length ? (
        <section className={styles.faq} aria-labelledby="faq-title">
          <div className={`wrap ${styles.faqGrid}`}>
            <div>
              <h2 id="faq-title">Questions</h2>
              <p className="muted">
                <Link href="/faq" className="link">
                  All questions
                </Link>{" "}
                or{" "}
                <Link href="/contact" className="link">
                  ask us directly
                </Link>
                .
              </p>
            </div>
            <FaqList items={faq} />
          </div>
        </section>
      ) : null}

      {/* Other experiences */}
      {others.length ? (
        <section className={styles.others} aria-labelledby="others-title">
          <div className="wrap">
            <h2 id="others-title" className={styles.h2}>
              Or try something else
            </h2>
            <div className={styles.otherGrid}>
              {others.map((o) => {
                const ot = themeOf(o);
                const photo = cardPhotoFor(ot);
                return (
                  <Link key={o.slug} href={`/experiences/${o.slug}`} className={styles.otherCard} data-theme={ot}>
                    <div className={styles.otherImg}>
                      <Image src={photo.src} alt="" fill sizes="(max-width: 700px) 92vw, 560px" className={styles.cover} />
                    </div>
                    <div className={styles.otherBody}>
                      <span className={styles.otherLabel}>{MOODS[ot]?.label ?? o.shortName}</span>
                      <strong>{o.shortName}</strong>
                      <span className="muted">
                        {durationLabel(o)} · {priceLabel(o)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <StickyBookBar price={priceLabel(e).replace(/ per .*$/, "")} unit={priceUnit(e)} />
    </div>
  );
}
