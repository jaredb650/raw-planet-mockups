"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the gift card success page every few seconds until the payment lands (max ~2 min). */
export function GiftCardPending() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      if (n > 40) clearInterval(timer);
      else router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
