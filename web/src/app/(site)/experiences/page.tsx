import type { Metadata } from "next";
import Link from "next/link";
import { ExperienceRow } from "@/components/site/ExperienceRow";
import { ageLabel, durationLabel, groupLabel, priceLabel, themeOf } from "@/components/site/format";
import { JsonLd } from "@/components/site/JsonLd";
import { PageHeader } from "@/components/site/PageHeader";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { MOODS } from "@/content/site";
import { siteUrl } from "@/lib/config";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "./experiences.module.css";

export const metadata: Metadata = {
  title: "Experiences",
  description: "Music production, DJ and sound meditation sessions in New York City. Private, beginner-friendly and hosted by producer Alex Gentil.",
  alternates: { canonical: "/experiences" },
  openGraph: { url: "/experiences" },
};

const TAKE_HOME: Record<string, string> = {
  production: "Your finished track",
  dj: "Your first real set",
  wellness: "A slower heartbeat",
};

export default async function ExperiencesPage() {
  const experiences = await getActiveExperiences();
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Experiences", path: "/experiences" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: experiences.map((e, i) => ({ "@type": "ListItem", position: i + 1, url: siteUrl(`/experiences/${e.slug}`), name: e.name })),
          },
        ]}
      />
      <PageHeader
        crumbs={[{ name: "Experiences" }]}
        eyebrow="Private sessions in New York City"
        title="Three rooms. Three ways in."
        lede="Make a track, play your first DJ set or lie back inside the sound. Every session is hosted by Alex, and you don't need to know anything before you arrive."
      />

      <section className={styles.compareWrap} aria-labelledby="compare-title">
        <div className="wrap">
          <h2 id="compare-title" className="sr-only">
            Compare the experiences
          </h2>
          <div className={styles.compare} role="region" aria-label="Compare experiences" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Detail</span>
                  </th>
                  {experiences.map((e) => (
                    <th key={e.slug} scope="col" data-theme={themeOf(e)}>
                      <span className={styles.colLabel}>{MOODS[themeOf(e)]?.label ?? e.shortName}</span>
                      <Link href={`/experiences/${e.slug}`}>{e.shortName}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Length</th>
                  {experiences.map((e) => (
                    <td key={e.slug}>{durationLabel(e)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Price</th>
                  {experiences.map((e) => (
                    <td key={e.slug}>
                      {priceLabel(e)} {e.isPlaceholder ? <span className="tag-ph">to confirm</span> : null}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Who</th>
                  {experiences.map((e) => (
                    <td key={e.slug}>
                      {groupLabel(e)}
                      {ageLabel(e) ? `, ${ageLabel(e)!.toLowerCase()}` : ""}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Where</th>
                  {experiences.map((e) => (
                    <td key={e.slug}>{e.locationArea}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">You leave with</th>
                  {experiences.map((e) => (
                    <td key={e.slug}>{TAKE_HOME[themeOf(e)] ?? "A great story"}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">
                    <span className="sr-only">Book</span>
                  </th>
                  {experiences.map((e) => (
                    <td key={e.slug} data-theme={themeOf(e)}>
                      <Link href={`/experiences/${e.slug}#book`} className="btn btn--accent btn--sm">
                        Check dates<span className="sr-only"> for {e.shortName}</span>
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.rows} aria-label="The experiences">
        <div className="wrap">
          {experiences.map((e, i) => (
            <ExperienceRow key={e.slug} e={e} index={i} />
          ))}
        </div>
      </section>

      <section className={styles.cta} aria-labelledby="cta-title">
        <div className={`wrap ${styles.ctaGrid}`}>
          <h2 id="cta-title">Not sure which one?</h2>
          <p>Tell us who&rsquo;s coming and what you&rsquo;re celebrating. Alex will suggest the session that fits, in English or Spanish.</p>
          <div className={styles.ctaBtns}>
            <Link href="/contact" className="btn btn--light">
              Ask Alex
            </Link>
            <Link href="/groups" className="btn btn--ghost">
              Planning for a group
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
