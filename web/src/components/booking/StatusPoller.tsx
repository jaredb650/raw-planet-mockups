"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * While a booking is still pending_payment (Stripe webhook not landed yet),
 * poll the status endpoint and refresh the page once it changes.
 */
export function StatusPoller({ code, token, sessionId }: { code: string; token: string; sessionId?: string | null }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const qs = new URLSearchParams({ t: token, ...(sessionId ? { session_id: sessionId } : {}) });
    async function tick() {
      tries += 1;
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(code)}/status?${qs}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!stopped && body?.status && body.status !== "pending_payment") {
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
      if (stopped) return;
      if (tries === 15) setSlow(true);
      if (tries < 60) timer = setTimeout(tick, tries < 10 ? 2000 : 5000);
    }
    timer = setTimeout(tick, 1500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [code, token, sessionId, router]);

  return slow ? (
    <p className="small" role="status" style={{ marginTop: 16 }}>
      This is taking longer than usual. Your spot is held, and you&rsquo;ll get an email as soon as the payment clears. You can
      safely close this page.
    </p>
  ) : null;
}
