"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Logo } from "./Logo";
import { mainNav } from "./nav";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ experiences }: { experiences: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  /** Label of the open dropdown (desktop) or accordion (mobile panel). */
  const [sub, setSub] = useState<string | null>(null);
  const pathname = usePathname();
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [lastPath, setLastPath] = useState(pathname);
  const nav = mainNav(experiences);

  // Close everything after navigating (adjusting state during render, per React docs).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setSub(null);
  }

  useEffect(() => {
    if (!open && !sub) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (open) toggleRef.current?.focus();
      setOpen(false);
      setSub(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSub(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, sub]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const close = () => {
    setOpen(false);
    setSub(null);
  };

  /** The same items render as a bar with dropdowns (desktop) and as a drop-down panel with accordions (mobile). */
  const items = (where: "bar" | "panel") =>
    nav.map((n) => {
      if ("href" in n) {
        return (
          <li key={n.label}>
            <Link href={n.href} onClick={close} aria-current={isActive(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          </li>
        );
      }
      const subId = `${menuId}-${where}-${n.label}`;
      const expanded = sub === n.label;
      return (
        <li key={n.label} className={styles.group} data-open={expanded || undefined}>
          <button type="button" aria-expanded={expanded} aria-controls={subId} onClick={() => setSub(expanded ? null : n.label)}>
            {n.label}
            <svg className={styles.chev} width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
              <path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <ul id={subId} className={styles.sub}>
            {n.children.map((c) => (
              <li key={c.href}>
                <Link href={c.href} onClick={close} aria-current={pathname === c.href ? "page" : undefined}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      );
    });

  return (
    <header ref={headerRef} className={styles.top} data-band="navy" data-open={open || undefined}>
      <div className={`wrap ${styles.bar}`}>
        <Logo onClick={close} />
        <nav className={styles.nav} aria-label="Main">
          <ul>{items("bar")}</ul>
        </nav>
        <div className={styles.actions}>
          <Link href="/book" className={`btn btn--accent ${styles.cta}`} onClick={close}>
            Book now
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => {
              setOpen((o) => !o);
              setSub(null);
            }}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span className={styles.burger} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div id={menuId} className={styles.panel} hidden={!open}>
        <nav aria-label="Mobile" className={styles.panelNav}>
          <ul>{items("panel")}</ul>
          <Link href="/book" className="btn btn--accent btn--block" onClick={close}>
            Book now
          </Link>
        </nav>
      </div>
    </header>
  );
}
