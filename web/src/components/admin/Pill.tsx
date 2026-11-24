import a from "./admin.module.css";
import { BOOKING_STATUS, PAYMENT_STATUS, DELIVERABLE, themeKey, type Tone } from "./format";
import type { BookingStatus, DeliverableStatus, PaymentStatus } from "@/lib/db/schema";

export function Pill({ tone = "neutral", children, plain }: { tone?: Tone; children: React.ReactNode; plain?: boolean }) {
  return <span className={`${a.pill} ${a[`tone_${tone}`]} ${plain ? a.pillPlain : ""}`}>{children}</span>;
}

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function DeliverablePill({ status }: { status: DeliverableStatus }) {
  const s = DELIVERABLE[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

/** Experience name with its colour swatch. */
export function ExpName({ theme, name }: { theme: string; name: string }) {
  return (
    <span className={a.nowrap}>
      <span className={`${a.swatch} ${a[`exp_${themeKey(theme)}`]}`} aria-hidden />
      {name}
    </span>
  );
}
