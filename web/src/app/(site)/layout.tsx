import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "./site.module.css";

// Public pages read live data (events, reviews, prices the host edits in admin).
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const experiences = (await getActiveExperiences()).map((e) => ({ slug: e.slug, shortName: e.shortName, theme: e.theme }));
  return (
    <>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <SiteHeader experiences={experiences} />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <SiteFooter experiences={experiences} />
    </>
  );
}
