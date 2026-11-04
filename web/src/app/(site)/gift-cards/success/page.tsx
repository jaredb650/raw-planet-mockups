import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGiftCard, verifyGiftCardLinkToken } from "@/lib/giftcards";
import { reconcileGiftCardPayment } from "@/app/api/_lib/stripe-sync";
import { formatMoney } from "@/lib/money";
import { fmtDateLong } from "@/lib/time";
import { GiftCardPending } from "@/components/booking/GiftCardPending";
import styles from "@/components/booking/pages.module.css";

export const metadata: Metadata = { title: "Your gift card", robots: { index: false, follow: false }, referrer: "same-origin" };

export default async function GiftCardSuccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";
  const k = typeof sp.k === "string" ? sp.k : "";
  if (!id || !verifyGiftCardLinkToken(id, k)) notFound();
  let card = await getGiftCard(id);
  if (!card) notFound();
  if (card.status === "pending_payment") card = await reconcileGiftCardPayment(card, typeof sp.session_id === "string" ? sp.session_id : null);

  if (card.status === "pending_payment") {
    return (
      <section className={styles.page}>
        <div className="wrap-narrow">
          <div className={styles.hero} data-tone="wait" role="status">
            <p className="eyebrow">Almost done</p>
            <h1>
              <span className={styles.spinner} aria-hidden="true" />
              Confirming
            </h1>
            <p>We&rsquo;re waiting for the payment to clear. This page updates by itself.</p>
            <GiftCardPending />
          </div>
        </div>
      </section>
    );
  }
  if (card.status === "void") {
    return (
      <section className={styles.page}>
        <div className="wrap-narrow">
          <div className={styles.hero} data-tone="off">
            <p className="eyebrow">Gift card</p>
            <h1>Not completed</h1>
            <p>This checkout wasn&rsquo;t completed, so no payment was taken.</p>
            <div className={styles.actions}>
              <Link href="/gift-cards" className="btn btn--accent">
                Try again
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const scheduled = card.recipientEmail && card.deliverAt && !card.deliveredAt;
  return (
    <section className={styles.page}>
      <div className="wrap">
        <div className={styles.layout}>
          <div className={styles.stack} style={{ gap: 24 }}>
            <div>
              <p className="eyebrow">Thank you, {card.purchaserName.split(" ")[0]}</p>
              <h1 className={styles.titleSm}>Your gift is ready</h1>
            </div>
            <p className="lede" style={{ margin: 0 }}>
              {card.recipientEmail
                ? scheduled
                  ? `We'll email it to ${card.recipientName ?? card.recipientEmail} on ${fmtDateLong(card.deliverAt!)}. Your receipt is on its way to ${card.purchaserEmail}.`
                  : `We've emailed it to ${card.recipientName ?? card.recipientEmail}, and sent your receipt to ${card.purchaserEmail}.`
                : `We've emailed the card to ${card.purchaserEmail} so you can pass it on. The code is below too.`}
            </p>
            <div>
              <p className="label" style={{ margin: "0 0 8px" }}>
                Gift card code
              </p>
              <p className={styles.giftCode}>{card.code}</p>
              <p className="small muted" style={{ margin: "8px 0 0" }}>
                Enter it under &ldquo;Promo code or gift card&rdquo; at checkout. Balance left: {formatMoney(card.balanceCents)}.
              </p>
            </div>
            <div className={styles.actions} style={{ marginTop: 0 }}>
              <Link href="/book" className="btn btn--accent">
                Browse sessions
              </Link>
              <Link href="/gift-cards" className="btn btn--ghost">
                Buy another
              </Link>
            </div>
          </div>
          <aside className={styles.aside}>
            <div className={styles.giftPreview}>
              <span className={styles.gpBrand}>Raw Planet</span>
              <span className={`${styles.gpAmount} tabular`}>{formatMoney(card.initialCents)}</span>
              <span className={styles.gpFor}>
                {card.recipientName ? `For ${card.recipientName} · ` : ""}from {card.purchaserName}
              </span>
            </div>
            {card.message ? (
              <blockquote className={styles.cardSoft} style={{ margin: "20px 0 0", fontStyle: "italic" }}>
                &ldquo;{card.message}&rdquo;
              </blockquote>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
