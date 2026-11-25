"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the gift card success page every few seconds until the payment lands (max ~2 min). */
export function GiftCardPending() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      if (n > 40) {
        clearInterval(timer);
        setTimedOut(true);
      } else {
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  if (!timedOut) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <p className="muted" style={{ marginBottom: 12 }}>
        This is taking a little longer than usual. Your gift card will still be emailed as soon as Stripe finishes confirming your payment.
      </p>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => {
          setTimedOut(false);
          router.refresh();
        }}
      >
        Check again
      </button>
    </div>
  );
}
