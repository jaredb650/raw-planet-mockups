"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Logo } from "./Logo";
import { MAIN_NAV } from "./nav";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ experiences }: { experiences: { slug: string; shortName: string; theme: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the menu after navigating (adjusting state during render, per React docs).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => !href.startsWith("/#") && pathname.startsWith(href);
  const close = () => setOpen(false);

  return (
    <header className={styles.top} data-open={open || undefined}>
      <div className={`wrap ${styles.bar}`}>
        <Logo onClick={close} />
        <nav className={styles.nav} aria-label="Main">
          {MAIN_NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link href="/book" className={`btn btn--accent ${styles.cta}`}>
            Book now
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span className={styles.burger} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div id={menuId} className={styles.panel} hidden={!open}>
        <nav aria-label="Mobile" className={`wrap ${styles.panelNav}`}>
          <ul>
            {MAIN_NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={close} aria-current={isActive(n.href) ? "page" : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.panelExps}>
            <p className="eyebrow">Book a session</p>
            {experiences.map((e) => (
              <Link key={e.slug} href={`/experiences/${e.slug}`} onClick={close} className={styles.panelExp} data-theme={e.theme}>
                <span className={styles.dot} aria-hidden="true" />
                {e.shortName}
              </Link>
            ))}
          </div>
          <div className={styles.panelFoot}>
            <Link href="/groups" onClick={close}>Groups &amp; private events</Link>
            <Link href="/manage" onClick={close}>Manage a booking</Link>
            <Link href="/contact" onClick={close}>Contact</Link>
          </div>
          <Link href="/book" className="btn btn--accent btn--block" onClick={close}>
            Book now
          </Link>
        </nav>
      </div>
    </header>
  );
}
