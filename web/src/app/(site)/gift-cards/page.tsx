import type { Metadata } from "next";
import Link from "next/link";
import { GIFT_CARD_MAX_CENTS, GIFT_CARD_MIN_CENTS } from "@/lib/giftcards";
import { getActiveExperiences } from "@/lib/queries/public";
import { formatMoney } from "@/lib/money";
import { todayKey } from "@/lib/time";
import { GiftCardBalance, GiftCardForm } from "@/components/booking/GiftCardForm";
import styles from "@/components/booking/pages.module.css";

export const metadata: Metadata = {
  title: "Gift cards",
  description: "Give a music production, DJ or sound meditation session in New York. Delivered by email, on the day you choose.",
  alternates: { canonical: "/gift-cards" },
};

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const experiences = await getActiveExperiences();
  // Presets anchored to real prices: one guest and two guests for the shortest private session.
  const anchor = experiences.find((e) => e.minGuests <= 2) ?? experiences[0];
  const base = anchor ? Math.min(...anchor.durationOptions.map((o) => o.priceCents)) : 15000;
  const hours = anchor ? Math.min(...anchor.durationOptions.map((o) => o.minutes)) / 60 : 2;
  const unit = anchor?.pricingMode === "per_session" ? "session" : "guest";
  const presets = [
    { cents: 10000, hint: "A little push" },
    { cents: base, hint: `1 ${unit}, ${hours} hours` },
    { cents: base * 2, hint: `2 ${unit}s, ${hours} hours` },
  ];
  const shown = presets.filter((p, i) => p.cents >= GIFT_CARD_MIN_CENTS && p.cents <= GIFT_CARD_MAX_CENTS && presets.findIndex((q) => q.cents === p.cents) === i);

  return (
    <section className={styles.page}>
      <div className="wrap">
        {sp.cancelled ? (
          <p className="notice notice--warning" role="status" style={{ marginBottom: 20 }}>
            No payment was taken. Try again whenever you&rsquo;re ready.
          </p>
        ) : null}
        <header className={styles.head}>
          <div>
            <p className="eyebrow">Gift cards</p>
            <h1 className={styles.title}>Give them two hours to lose track</h1>
          </div>
          <p className="lede">
            Good for any session: making a track, learning to DJ, or a sound bath with friends. From {formatMoney(GIFT_CARD_MIN_CENTS)}.
          </p>
        </header>
        <GiftCardForm presets={shown} minCents={GIFT_CARD_MIN_CENTS} maxCents={GIFT_CARD_MAX_CENTS} today={todayKey()} />

        <div className={styles.grid2} style={{ marginTop: 40 }}>
          <div className={styles.cardSoft}>
            <h2 className={styles.cardTitle}>Check a balance</h2>
            <GiftCardBalance />
          </div>
          <div className={styles.cardSoft}>
            <h2 className={styles.cardTitle}>Rather gift a set time?</h2>
            <p className="muted">
              Book the session yourself and tick &ldquo;This session is a gift&rdquo; at checkout. We&rsquo;ll send them a card with the date,
              and they can move it if it doesn&rsquo;t suit.
            </p>
            <Link href="/book" className="btn btn--ghost btn--sm">
              Pick a time
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
