"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type MoodItem = { slug: string; theme: string };
type Ctx = { slug: string; theme: string; picked: boolean; choose: (slug: string, opts?: { scroll?: boolean }) => void };

const MoodCtx = createContext<Ctx | null>(null);

/**
 * Holds the experience chosen in the home "mood" chooser. Re-tints everything
 * inside via data-theme, and tells the booking section which experience to show.
 */
export function MoodProvider({
  items,
  initialSlug,
  initialPicked = false,
  children,
  className,
}: {
  items: MoodItem[];
  initialSlug: string;
  /** True when the URL already named an experience; otherwise the page starts in the neutral brick theme. */
  initialPicked?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [picked, setPicked] = useState(initialPicked);
  const theme = picked ? (items.find((i) => i.slug === slug)?.theme ?? "brick") : "brick";

  const choose = useCallback((next: string, opts?: { scroll?: boolean }) => {
    setSlug(next);
    setPicked(true);
    if (opts?.scroll) {
      const target = document.getElementById("book");
      if (target) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", `?experience=${next}#book`);
      }
    }
  }, []);

  const value = useMemo(() => ({ slug, theme, picked, choose }), [slug, theme, picked, choose]);
  return (
    <MoodCtx.Provider value={value}>
      <div data-theme={theme} className={className}>
        {children}
      </div>
    </MoodCtx.Provider>
  );
}

export function useMood(): Ctx {
  const c = useContext(MoodCtx);
  if (!c) throw new Error("useMood must be used inside <MoodProvider>");
  return c;
}

/** "Check dates" button on experience rows: picks the experience and scrolls to #book. Works as a plain link without JS. */
export function PickExperienceLink({ slug, children, className }: { slug: string; children: React.ReactNode; className?: string }) {
  const { choose } = useMood();
  return (
    <a
      href={`/?experience=${slug}#book`}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        choose(slug, { scroll: true });
      }}
    >
      {children}
    </a>
  );
}
