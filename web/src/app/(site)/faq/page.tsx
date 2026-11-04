import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/site/FaqList";
import { FaqSearch } from "@/components/site/FaqSearch";
import { resolveFaq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/JsonLd";
import { PageHeader } from "@/components/site/PageHeader";
import { breadcrumbJsonLd } from "@/components/site/schema";
import { FAQ_CATEGORIES } from "@/content/site";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "./faq.module.css";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about Raw Planet sessions: experience needed, what to bring, kids, Spanish, group sizes, payment, gift cards, cancelling and rescheduling.",
  alternates: { canonical: "/faq" },
  openGraph: { url: "/faq" },
};

export default async function FaqPage() {
  const faq = resolveFaq(await getActiveExperiences());
  const groups = FAQ_CATEGORIES.map((c) => ({ ...c, items: faq.filter((f) => f.category === c.id) })).filter((g) => g.items.length);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ]}
      />
      <PageHeader crumbs={[{ name: "FAQ" }]} title="Good questions." lede="Everything people usually ask before they come. Can't find yours? Ask us and Alex will answer personally.">
        <div className={styles.search}>
          <FaqSearch scopeId="faq-all" />
        </div>
      </PageHeader>

      <div className={`wrap ${styles.layout}`}>
        <nav className={styles.toc} aria-label="FAQ topics">
          <p className="eyebrow">Topics</p>
          <ul>
            {groups.map((g) => (
              <li key={g.id}>
                <a href={`#${g.id}`}>
                  {g.title} <span className={styles.n}>{g.items.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div id="faq-all" className={styles.groups}>
          {groups.map((g) => (
            <section key={g.id} id={g.id} className={styles.group} aria-labelledby={`${g.id}-title`} data-faq-group="">
              <h2 id={`${g.id}-title`} className={styles.h2}>
                {g.title}
              </h2>
              <FaqList items={g.items} />
            </section>
          ))}
        </div>
      </div>

      <section className={styles.ask} aria-labelledby="ask-title">
        <div className={`wrap ${styles.askGrid}`}>
          <h2 id="ask-title">Still wondering?</h2>
          <p>Write to Alex and you&rsquo;ll hear back from a real person, usually within a day. ¿Prefieres español? Escríbenos en español.</p>
          <div className={styles.askBtns}>
            <Link href="/contact" className="btn btn--light">
              Ask a question
            </Link>
            <Link href="/experiences" className="btn btn--ghost">
              Browse experiences
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
