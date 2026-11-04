import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { integrations } from "@/lib/config";
import { getDb } from "@/lib/db";
import { experiences } from "@/lib/db/schema";
import { getBooking, getBookingForCustomer } from "@/lib/booking/service";
import { getGiftCard, verifyGiftCardLinkToken } from "@/lib/giftcards";
import { formatMoney } from "@/lib/money";
import { fmtDateLong, fmtTimeRange } from "@/lib/time";
import { SubmitButton } from "@/components/booking/SubmitButton";
import { guestsLabel, themeOf } from "@/components/booking/format";
import styles from "@/components/booking/pages.module.css";
import { cancelTestBooking, cancelTestGiftCard, payTestBooking, payTestGiftCard } from "./actions";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false, follow: false }, referrer: "same-origin" };

type Props = {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Stand-in for Stripe Checkout while STRIPE_SECRET_KEY is unset (local dev,
 * previews, e2e). 404s as soon as Stripe is configured.
 */
export default async function TestCheckoutPage({ params, searchParams }: Props) {
  if (!integrations.testCheckout()) notFound();
  const [{ kind, id }, sp] = await Promise.all([params, searchParams]);
  const t = typeof sp.t === "string" ? sp.t : "";

  let heading: string;
  let detail: React.ReactNode;
  let amount: number;
  let theme = "brick";
  let form: React.ReactNode;

  if (kind === "booking") {
    const pre = await getBooking(id);
    const b = pre ? await getBookingForCustomer(pre.code, t) : undefined;
    if (!b) notFound();
    const db = await getDb();
    const [exp] = await db.select().from(experiences).where(eq(experiences.id, b.experienceId)).limit(1);
    theme = exp ? themeOf(exp) : "brick";
    heading = exp?.name ?? "Your session";
    amount = b.totalCents;
    detail = (
      <>
        {fmtDateLong(b.startAt)}, {fmtTimeRange(b.startAt, b.endAt)} · {guestsLabel(b.guests)} · {b.code}
      </>
    );
    form =
      b.status === "pending_payment" || b.status === "expired" ? (
        <PayButtons pay={payTestBooking} cancel={cancelTestBooking} hidden={{ id: b.id, t, slug: exp?.slug ?? "" }} label={`Pay ${formatMoney(amount)} (test)`} />
      ) : (
        <p className="notice">
          This booking is already {b.status.replace("_", " ")}.{" "}
          <a className="link" href={`/booking/${b.code}?t=${b.manageToken}`}>
            View it
          </a>
        </p>
      );
  } else if (kind === "gift_card") {
    if (!verifyGiftCardLinkToken(id, t)) notFound();
    const card = await getGiftCard(id);
    if (!card) notFound();
    heading = "Raw Planet gift card";
    amount = card.initialCents;
    detail = card.recipientName ? <>For {card.recipientName}</> : <>Good for any session</>;
    form =
      card.status === "pending_payment" ? (
        <PayButtons pay={payTestGiftCard} cancel={cancelTestGiftCard} hidden={{ id: card.id, t }} label={`Pay ${formatMoney(amount)} (test)`} />
      ) : (
        <p className="notice">This gift card checkout is already closed ({card.status.replace("_", " ")}).</p>
      );
  } else {
    notFound();
  }

  return (
    <section className={styles.page}>
      <div className="wrap-narrow">
        <div className={styles.card} data-theme={theme}>
          <div className={styles.stack}>
            <span className={styles.testBadge}>Test mode · no card is charged</span>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 10px" }}>
                Checkout
              </p>
              <h1 className={styles.titleSm}>{heading}</h1>
              <p className="muted" style={{ margin: "12px 0 0" }}>
                {detail}
              </p>
            </div>
            <div className={styles.totalRow}>
              <span>Total due</span>
              <strong className="tabular">{formatMoney(amount)}</strong>
            </div>
            <div className={styles.fakeCard} aria-label="Test card">
              <span>Stripe isn&rsquo;t connected yet, so this page stands in for Stripe Checkout.</span>
              <code>4242 4242 4242 4242</code>
              <span>Add STRIPE_SECRET_KEY to take real payments. See docs/SETUP.md.</span>
            </div>
            {form}
          </div>
        </div>
      </div>
    </section>
  );
}

function PayButtons(props: {
  pay: (form: FormData) => Promise<void>;
  cancel: (form: FormData) => Promise<void>;
  hidden: Record<string, string>;
  label: string;
}) {
  const inputs = Object.entries(props.hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  return (
    <div className={styles.stack} style={{ gap: 12 }}>
      <form action={props.pay}>
        {inputs}
        <SubmitButton className="btn btn--accent btn--block" pendingLabel="Processing…">
          {props.label}
        </SubmitButton>
      </form>
      <form action={props.cancel}>
        {inputs}
        <SubmitButton className="btn btn--ghost btn--block" pendingLabel="Going back…">
          Cancel and go back
        </SubmitButton>
      </form>
    </div>
  );
}
