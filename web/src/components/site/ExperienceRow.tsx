import Image from "next/image";
import Link from "next/link";
import type { PublicExperience } from "@/lib/queries/public";
import { quickFacts, themeOf } from "./format";
import { LoopVideo } from "./LoopVideo";
import { cardPhotoFor, loopFor } from "./media";
import { PickExperienceLink } from "./MoodContext";
import styles from "./ExperienceRow.module.css";

/**
 * The experiences, one after another. Desktop: image and text alternate sides.
 * Phones: a swipeable left/right carousel of cards (CSS scroll snap, no script).
 */
export function ExperienceRows({ experiences, pickable }: { experiences: PublicExperience[]; pickable?: boolean }) {
  return (
    <>
      <div className={styles.track} role="list" aria-label="Experiences">
        {experiences.map((e, i) => (
          <div key={e.slug} role="listitem" className={styles.item}>
            <ExperienceRow e={e} index={i} pickable={pickable} />
          </div>
        ))}
      </div>
      {experiences.length > 1 ? (
        <p className={styles.swipe} aria-hidden="true">
          Swipe to see all {experiences.length} <span>→</span>
        </p>
      ) : null}
    </>
  );
}

function ExperienceRow({ e, index, pickable }: { e: PublicExperience; index: number; pickable?: boolean }) {
  const theme = themeOf(e);
  const photo = cardPhotoFor(theme);
  const loop = loopFor(theme);
  const facts = quickFacts(e);
  const flip = index % 2 === 1;

  return (
    <article className={styles.row} data-theme={theme} data-flip={flip || undefined} aria-labelledby={`exp-${e.slug}`}>
      <div className={styles.media}>
        {theme === "wellness" && loop ? (
          <LoopVideo src={loop.src} poster={loop.poster} label={loop.alt} className={styles.mediaFill} />
        ) : (
          <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 980px) 100vw, 580px" className={styles.img} />
        )}
        {theme === "production" && loop ? (
          <div className={styles.inset}>
            <LoopVideo src={loop.src} poster={loop.poster} label={loop.alt} className={styles.mediaFill} />
          </div>
        ) : null}
      </div>
      <div className={styles.body}>
        <p className={styles.kicker}>
          <span className={styles.num}>0{index + 1}</span> {e.locationArea}
        </p>
        <h3 id={`exp-${e.slug}`} className={styles.title}>
          <Link href={`/experiences/${e.slug}`}>{e.name}</Link>
        </h3>
        <p className={styles.summary}>{e.summary}</p>
        <ul className={styles.flow}>
          {e.highlights.slice(0, 4).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <ul className={styles.facts} aria-label="Quick facts">
          {facts.map((f) => (
            <li key={f.label}>
              {f.label}
              {f.ph ? <span className="tag-ph">details to confirm</span> : null}
            </li>
          ))}
        </ul>
        <div className={styles.ctas}>
          {pickable ? (
            <PickExperienceLink slug={e.slug} className="btn btn--accent">
              Check dates
            </PickExperienceLink>
          ) : (
            <Link href={`/experiences/${e.slug}#book`} className="btn btn--accent">
              Check dates
            </Link>
          )}
          <Link href={`/experiences/${e.slug}`} className="btn btn--ghost">
            Learn more <span className="sr-only">about the {e.name}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
