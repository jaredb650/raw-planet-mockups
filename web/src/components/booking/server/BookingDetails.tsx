import "server-only";
import type { Booking, Experience } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { fmtDateLong, fmtDuration, fmtTimeRange } from "@/lib/time";
import { guestsLabel } from "../format";
import styles from "../pages.module.css";

/** Booking facts card shared by the confirmation and manage pages. */
export function BookingDetails({ booking: b, experience: e }: { booking: Booking; experience: Experience }) {
  const live = b.status === "confirmed" || b.status === "completed";
  const paidLine =
    b.amountPaidCents > 0
      ? `${formatMoney(b.amountPaidCents)} paid${b.giftCardCents > 0 ? ` + ${formatMoney(b.giftCardCents)} gift card` : ""}`
      : b.giftCardCents > 0
        ? `${formatMoney(b.giftCardCents)} on gift card`
        : b.totalCents === 0
          ? "Nothing to pay"
          : `${formatMoney(b.totalCents)} due`;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{e.name}</h2>
        <span className="pill tabular">{b.code}</span>
      </div>
      <dl className={styles.facts}>
        <Fact label="When">
          {fmtDateLong(b.startAt)}
          <small>{fmtTimeRange(b.startAt, b.endAt)} · New York time · {fmtDuration(b.durationMinutes)}</small>
        </Fact>
        <Fact label="Guests">
          {guestsLabel(b.guests)}
          {b.isGift && b.giftRecipientName ? <small>A gift for {b.giftRecipientName}</small> : null}
        </Fact>
        <Fact label="Where">
          {live && e.address ? e.address : e.locationArea}
          {live && e.arrivalInstructions ? <small>{e.arrivalInstructions}</small> : null}
        </Fact>
        <Fact label="Payment">
          {paidLine}
          {b.amountRefundedCents > 0 ? <small>{formatMoney(b.amountRefundedCents)} refunded to your card</small> : null}
        </Fact>
        {b.language === "es" ? <Fact label="Language">Español</Fact> : null}
      </dl>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ gridTemplateColumns: "92px 1fr" }}>
      <dt className="small">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
