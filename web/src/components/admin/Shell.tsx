"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Mark } from "./Mark";
import s from "./shell.module.css";
import a from "./admin.module.css";

export type NavBadges = Partial<Record<string, number>>;

type Item = { href: string; label: string; icon: string; match?: string[]; badgeKey?: string; badgeTone?: "attention" | "quiet" };
const GROUPS: { label?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/admin", label: "Today", icon: "today", badgeKey: "today" },
      { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
      { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
      { href: "/admin/customers", label: "Customers", icon: "customers" },
      { href: "/admin/inquiries", label: "Inquiries", icon: "inquiries", badgeKey: "inquiries" },
    ],
  },
  {
    label: "Set up",
    items: [
      { href: "/admin/experiences", label: "Experiences", icon: "experiences" },
      { href: "/admin/availability", label: "Availability", icon: "availability", badgeKey: "availability" },
      { href: "/admin/gift-cards", label: "Gift cards & promos", icon: "gift", match: ["/admin/promos"] },
      { href: "/admin/reviews", label: "Reviews", icon: "reviews", badgeKey: "reviews" },
      { href: "/admin/events", label: "Events", icon: "events" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/emails", label: "Emails", icon: "emails", badgeKey: "emails" },
      { href: "/admin/settings", label: "Settings", icon: "settings" },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);
const TABS = ["/admin", "/admin/calendar", "/admin/bookings", "/admin/inquiries"];

function isActive(pathname: string, item: Item) {
  if (item.href === "/admin") return pathname === "/admin";
  return [item.href, ...(item.match ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));
}

const BADGE_TITLES: Record<string, (n: number) => string> = {
  today: (n) => `${n} to check`,
  inquiries: (n) => `${n} new`,
  availability: (n) => `${n} calendar ${n === 1 ? "feed" : "feeds"} failing`,
  reviews: (n) => `${n} waiting for approval`,
  emails: (n) => `${n} failed this week`,
};

function Badge({ n, k }: { n?: number; k?: string }) {
  if (!n) return null;
  const title = k && BADGE_TITLES[k] ? BADGE_TITLES[k](n) : String(n);
  return (
    <span className={s.badge} title={title}>
      <span aria-hidden>{n}</span>
      <span className="sr-only">{title}</span>
    </span>
  );
}

export function Shell({ badges, logout, children }: { badges: NavBadges; logout: () => Promise<void>; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const moreCount = ALL.filter((i) => !TABS.includes(i.href) && i.badgeKey).reduce((n, i) => n + (badges[i.badgeKey!] ?? 0), 0);

  // Close the phone menu on navigation (render-time adjustment, no effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [menuOpen]);

  const nav = (
    <nav aria-label="Admin" className={s.nav}>
      {GROUPS.map((g, gi) => (
        <div key={gi} className={s.group}>
          {g.label && <p className={s.groupLabel}>{g.label}</p>}
          <ul>
            {g.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={`${s.item} ${active ? s.itemActive : ""}`} aria-current={active ? "page" : undefined}>
                    <Icon name={item.icon} size={17} />
                    <span className={s.itemLabel}>{item.label}</span>
                    <Badge n={item.badgeKey ? badges[item.badgeKey] : 0} k={item.badgeKey} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const foot = (
    <div className={s.foot}>
      <a href="/" className={s.item} target="_blank" rel="noreferrer">
        <Icon name="external" size={17} />
        <span className={s.itemLabel}>View website</span>
      </a>
      <form action={logout}>
        <button type="submit" className={s.item}>
          <Icon name="logout" size={17} />
          <span className={s.itemLabel}>Sign out</span>
        </button>
      </form>
    </div>
  );

  return (
    <div className={`${a.root} ${s.shell}`}>
      <a href="#admin-main" className={s.skip}>
        Skip to content
      </a>
      <aside className={s.sidebar}>
        <Link href="/admin" className={s.brand}>
          <Mark size={30} />
          <span>
            <span className={s.brandName}>Raw Planet</span>
            <span className={s.brandSub}>Studio admin</span>
          </span>
        </Link>
        {nav}
        {foot}
      </aside>

      <header className={s.topbar}>
        <Link href="/admin" className={s.topBrand} aria-label="Raw Planet admin home">
          <Mark size={26} />
        </Link>
        <span className={s.topTitle} aria-hidden>Raw Planet</span>
        <Link href="/admin/bookings/new" className={`${a.btn} ${a.btnSm} ${a.btnPrimary}`}>
          <Icon name="plus" size={15} /> Booking
        </Link>
      </header>

      <main id="admin-main" className={s.main}>
        {children}
      </main>

      <nav className={s.tabbar} aria-label="Quick">
        {TABS.map((href) => {
          const item = ALL.find((i) => i.href === href)!;
          const active = isActive(pathname, item);
          return (
            <Link key={href} href={href} className={`${s.tab} ${active ? s.tabActive : ""}`} aria-current={active ? "page" : undefined}>
              <span className={s.tabIcon}>
                <Icon name={item.icon} size={21} />
                {item.badgeKey && badges[item.badgeKey] ? <span className={s.dot}>{badges[item.badgeKey]}</span> : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button type="button" className={`${s.tab} ${menuOpen ? s.tabActive : ""}`} onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="admin-more">
          <span className={s.tabIcon}>
            <Icon name="menu" size={21} />
            {moreCount ? <span className={s.dot}>{moreCount}</span> : null}
          </span>
          More
        </button>
      </nav>

      {menuOpen && (
        <div className={s.sheet} id="admin-more" role="dialog" aria-modal="true" aria-label="All sections">
          <div className={s.sheetHead}>
            <span className={s.brand}>
              <Mark size={26} />
              <span className={s.brandName}>Raw Planet</span>
            </span>
            <button type="button" className={`${a.btn} ${a.iconBtn}`} onClick={() => setMenuOpen(false)} aria-label="Close menu" autoFocus>
              <Icon name="close" />
            </button>
          </div>
          {nav}
          {foot}
        </div>
      )}
    </div>
  );
}
