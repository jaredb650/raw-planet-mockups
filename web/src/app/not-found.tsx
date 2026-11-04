import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "./not-found.module.css";

export const metadata: Metadata = { title: "Page not found" };

/** Root 404: renders outside the (site) layout, so it brings its own header and footer. */
export default async function NotFound() {
  const experiences = (await getActiveExperiences().catch(() => [])).map((e) => ({ slug: e.slug, shortName: e.shortName, theme: e.theme }));
  return (
    <>
      <SiteHeader experiences={experiences} />
      <main id="main" className={styles.main}>
        <div className={`wrap ${styles.grid}`}>
          <div>
            <p className="eyebrow">404 · Page not found</p>
            <h1 className={styles.title}>
              Wrong room.
              <br />
              <span>Right building.</span>
            </h1>
            <p className="lede">That page has moved or never existed. Here&rsquo;s where most people are headed:</p>
            <ul className={styles.links}>
              {experiences.map((e) => (
                <li key={e.slug} data-theme={e.theme}>
                  <Link href={`/experiences/${e.slug}`}>
                    <span className={styles.dot} aria-hidden="true" />
                    {e.shortName}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/events">Community events</Link>
              </li>
              <li>
                <Link href="/faq">FAQ</Link>
              </li>
            </ul>
            <div className={styles.ctas}>
              <Link href="/" className="btn btn--accent">
                Back to the start
              </Link>
              <Link href="/contact" className="btn btn--ghost">
                Ask us
              </Link>
            </div>
          </div>
          <div className={styles.record} aria-hidden="true">
            <span>4</span>
            <span className={styles.disc} />
            <span>4</span>
          </div>
        </div>
      </main>
      <SiteFooter experiences={experiences} />
    </>
  );
}
