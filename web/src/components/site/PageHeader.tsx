import Link from "next/link";
import styles from "./PageHeader.module.css";

export type Crumb = { name: string; href?: string };

/** Title block for inner pages: breadcrumb, eyebrow, big display title, lede and an optional side slot. */
export function PageHeader({
  title,
  eyebrow,
  lede,
  crumbs,
  children,
  aside,
  tone = "plain",
  id = "page-title",
}: {
  title: React.ReactNode;
  eyebrow?: string;
  lede?: React.ReactNode;
  crumbs?: Crumb[];
  children?: React.ReactNode;
  aside?: React.ReactNode;
  tone?: "plain" | "mist" | "ink" | "accent";
  id?: string;
}) {
  return (
    <header className={styles.head} data-tone={tone}>
      <div className={`wrap ${styles.grid}`} data-aside={aside ? "" : undefined}>
        <div className={styles.copy}>
          {crumbs?.length ? <Breadcrumbs crumbs={crumbs} /> : null}
          {eyebrow ? <p className={`eyebrow ${styles.eyebrow}`}>{eyebrow}</p> : null}
          <h1 id={id} className={styles.title}>
            {title}
          </h1>
          {lede ? <p className={`lede ${styles.lede}`}>{lede}</p> : null}
          {children}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
    </header>
  );
}

/** "Home / … / Current" trail. The last crumb (no href) is the current page. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        <li>
          <Link href="/">Home</Link>
        </li>
        {crumbs.map((c) => (
          <li key={c.name}>{c.href ? <Link href={c.href}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}
