"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  getResponse: (id: string) => string | undefined;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const turnstileEnabled = Boolean(SITE_KEY);
let loading: Promise<void> | null = null;
const mounted = new Set<string>();

function loadScript(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Bot check for public forms. Put it inside the <form>: it adds a hidden `cf-turnstile-response`
 * field. Usually invisible; it only shows a challenge to suspicious visitors. Renders nothing without a site key.
 */
export function Turnstile() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY) return;
    let id: string | undefined;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, { sitekey: SITE_KEY, appearance: "interaction-only", size: "flexible", theme: "light" });
        mounted.add(id);
      })
      .catch(() => {}); // blocked script: the server check then fails with a clear message
    return () => {
      gone = true;
      if (id) {
        mounted.delete(id);
        window.turnstile?.remove(id);
      }
    };
  }, []);
  return SITE_KEY ? <div ref={ref} /> : null;
}

/** Tokens are single-use: call after a failed submit so the next attempt gets a fresh one. */
export function resetTurnstile() {
  for (const id of mounted) window.turnstile?.reset(id);
}

/**
 * The current token, waiting up to 8s for the invisible check to finish (a fast submit can beat it).
 * null when Turnstile isn't configured or never produced a token; the server then refuses with a clear message.
 */
export async function turnstileToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  for (let i = 0; i < 40; i++) {
    for (const id of mounted) {
      const t = window.turnstile?.getResponse(id);
      if (t) return t;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}
