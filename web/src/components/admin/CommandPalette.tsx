"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import p from "./palette.module.css";
import a from "./admin.module.css";

type Item = { href: string; title: string; sub?: string };
type Group = { label: string; items: Item[] };

const PAGES: Item[] = [
  { href: "/admin", title: "Today" },
  { href: "/admin/calendar", title: "Calendar" },
  { href: "/admin/bookings", title: "Bookings" },
  { href: "/admin/bookings/new", title: "New booking" },
  { href: "/admin/customers", title: "Customers" },
  { href: "/admin/inquiries", title: "Inquiries" },
  { href: "/admin/campaigns", title: "Campaigns" },
  { href: "/admin/reports", title: "Reports" },
  { href: "/admin/pricing", title: "Smart pricing" },
  { href: "/admin/experiences", title: "Experiences" },
  { href: "/admin/availability", title: "Availability" },
  { href: "/admin/gift-cards", title: "Gift cards" },
  { href: "/admin/promos", title: "Promo codes" },
  { href: "/admin/reviews", title: "Reviews" },
  { href: "/admin/events", title: "Events" },
  { href: "/admin/emails", title: "Emails" },
  { href: "/admin/settings", title: "Settings" },
];

/**
 * Cmd/Ctrl+K search. Mount it inside the phone top bar: its button shows there, and the dialog is
 * portalled out so it still opens on desktop, where that bar is hidden. A native modal <dialog>
 * gives us the focus trap, Esc and focus return.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current) dialog.current.close();
        else setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" className={`${a.btn} ${a.btnSm} ${a.iconBtn}`} onClick={() => setOpen(true)} aria-label="Search" aria-haspopup="dialog">
        <Icon name="search" size={17} />
      </button>
      {open && createPortal(<Palette dialog={dialog} onClosed={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Palette({ dialog, onClosed }: { dialog: React.RefObject<HTMLDialogElement | null>; onClosed: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; groups: Group[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const term = q.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    dialog.current?.showModal();
  }, [dialog]);

  useEffect(() => {
    if (!searching) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error();
        setFound({ q: term, groups: (await res.json()).groups });
        setFailed(false);
      } catch {
        if (!ctl.signal.aborted) setFailed(true);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [term, searching]);

  const pages = PAGES.filter((i) => i.title.toLowerCase().includes(term.toLowerCase()));
  const groups: Group[] = [...(pages.length ? [{ label: "Go to", items: pages }] : []), ...(searching && found ? found.groups : [])];
  const items = groups.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(0, items.length - 1));
  const pending = searching && found?.q !== term && !failed;

  useEffect(() => {
    document.getElementById(`cp-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function go(item?: Item) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) setActive((current + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[current]);
    }
  }

  let n = -1;
  return (
    <dialog
      ref={dialog}
      className={p.dialog}
      aria-label="Search admin"
      onClose={onClosed}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <div className={p.box}>
        <div className={p.bar}>
          <Icon name="search" size={18} />
          <input
            className={p.input}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="cp-list"
            aria-autocomplete="list"
            aria-activedescendant={items.length ? `cp-${current}` : undefined}
            aria-label="Search pages, bookings, customers and gift cards"
            placeholder="Search name, email, phone or code"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button type="button" className={`${a.btn} ${a.btnGhost} ${a.btnSm}`} onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        <div id="cp-list" role="listbox" aria-label="Results" className={p.list}>
          {groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div className={p.heading} aria-hidden>
                {g.label}
              </div>
              {g.items.map((item) => {
                const i = ++n;
                return (
                  <div
                    key={item.href}
                    id={`cp-${i}`}
                    role="option"
                    aria-selected={i === current}
                    className={`${p.option} ${i === current ? p.optionActive : ""}`}
                    onClick={() => go(item)}
                    onMouseMove={() => i !== current && setActive(i)}
                  >
                    <span className={p.title}>{item.title}</span>
                    {item.sub && <span className={p.sub}>{item.sub}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p role="status" aria-live="polite" className={p.status}>
          {failed ? "Search isn’t working right now." : pending ? "Searching…" : !items.length ? "No matches." : searching ? `${items.length} ${items.length === 1 ? "result" : "results"}` : ""}
        </p>
      </div>
    </dialog>
  );
}
