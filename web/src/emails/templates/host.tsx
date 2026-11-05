/** Host-facing emails (English): booking alerts and the daily run sheet. */
import { Column, Row, Section, Text } from "@react-email/components";
import { Layout } from "../components/Layout";
import { A, Actions, Btn, Code, Details, Divider, Gap, H1, H2, P, Panel, Pill } from "../components/ui";
import { accentFor, C, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { EmailOutput } from "../types";

export type HostAlertKind = "new" | "cancelled" | "rescheduled";

export type HostBookingView = {
  kind: HostAlertKind;
  id: string;
  code: string;
  theme: string;
  experienceName: string;
  /** "Sat, Nov 14, 2026" */
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  guests: number;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  language: string;
  sourceLabel: string;
  total: string;
  paid: string;
  addons: string[];
  promo: string | null;
  giftCardUsed: string | null;
  occasion: string | null;
  notes: string;
  isGift: boolean;
  giftRecipientName: string | null;
  previousLabel: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  refundLabel: string | null;
  /** e.g. "Couldn't add to Cal.com…" or overlap warnings. */
  warnings: string[];
  adminUrl: string;
  /** Hours until start (for "starts in 3 hours" urgency). */
  hoursUntil: number;
};

const KIND = {
  new: { label: "New booking", bg: "#DCEFD5", verb: "booked" },
  cancelled: { label: "Cancelled", bg: C.dangerSoft, verb: "cancelled" },
  rescheduled: { label: "Moved", bg: C.warningSoft, verb: "moved" },
} as const;

export function hostBookingAlertEmail(v: HostBookingView): EmailOutput {
  const k = KIND[v.kind];
  const accent = accentFor(v.theme);
  const soon = v.kind !== "cancelled" && v.hoursUntil >= 0 && v.hoursUntil < 48;
  const subject = `${v.kind === "new" ? "💰 " : v.kind === "cancelled" ? "✕ " : "↻ "}${k.label}: ${v.experienceName}, ${v.dateLabel} ${v.timeLabel.split(" – ")[0]} · ${v.contactName} (${v.guests})`;
  const preview =
    v.kind === "new"
      ? `${v.total} via ${v.sourceLabel}. ${v.guests} guest${v.guests === 1 ? "" : "s"}${v.occasion ? `, ${v.occasion}` : ""}.`
      : v.kind === "cancelled"
        ? `${v.refundLabel ?? "No refund"}. The slot is open again.`
        : `Was ${v.previousLabel}.`;
  const tel = v.contactPhone ? v.contactPhone.replace(/[^\d+]/g, "") : null;
  const element = (
    <Layout lang="en" audience="host" theme={v.theme} preview={preview}>
      <div style={{ marginBottom: "12px" }}>
        <Pill bg={k.bg}>{k.label}</Pill> <Pill bg={accent.soft}>{v.sourceLabel}</Pill>
        {v.language === "es" ? (
          <>
            {" "}
            <Pill bg={C.powder}>Español</Pill>
          </>
        ) : null}
        {soon ? (
          <>
            {" "}
            <Pill bg={C.ochre}>{v.hoursUntil < 24 ? "Within 24h" : "Within 48h"}</Pill>
          </>
        ) : null}
      </div>
      <H1>
        {v.contactName} · {v.guests}
      </H1>
      <P style={{ fontWeight: 700, margin: "0 0 4px" }}>{v.experienceName}</P>
      <P style={{ margin: "0 0 4px" }}>
        {v.kind === "cancelled" ? <s>{`${v.dateLabel}, ${v.timeLabel}`}</s> : `${v.dateLabel}, ${v.timeLabel}`} · {v.durationLabel}
      </P>
      {v.previousLabel ? (
        <P small muted>
          Was <s>{v.previousLabel}</s>
        </P>
      ) : null}
      {v.warnings.length ? (
        <Panel bg={C.dangerSoft}>
          {v.warnings.map((w, i) => (
            <P key={i} small style={{ margin: i === v.warnings.length - 1 ? 0 : "0 0 6px", fontWeight: 600, color: C.danger }}>
              ⚠ {w}
            </P>
          ))}
        </Panel>
      ) : null}
      <Details
        accent={accent.strong}
        rows={[
          { label: "Code", value: <Code>{v.code}</Code> },
          v.contactEmail ? { label: "Email", value: <A href={`mailto:${v.contactEmail}`}>{v.contactEmail}</A> } : null,
          v.contactPhone && tel
            ? {
                label: "Phone",
                value: (
                  <>
                    <A href={`tel:${tel}`}>{v.contactPhone}</A>
                    {"  ·  "}
                    <A href={`sms:${tel}`}>Text</A>
                    {"  ·  "}
                    <A href={`https://wa.me/${tel.replace(/[^\d]/g, "")}`}>WhatsApp</A>
                  </>
                ),
              }
            : null,
          v.isGift ? { label: "Gift", value: `For ${v.giftRecipientName ?? "someone else"} (booked by ${v.contactName})` } : null,
          v.occasion ? { label: "Occasion", value: v.occasion } : null,
          v.notes ? { label: "Guest notes", value: <span style={{ whiteSpace: "pre-line" }}>{v.notes}</span> } : null,
          v.addons.length ? { label: "Add-ons", value: v.addons.join(", ") } : null,
          v.kind === "cancelled"
            ? { label: "Refund", value: v.refundLabel ?? "None", strong: true }
            : { label: "Total", value: `${v.total}${v.paid !== v.total ? ` (paid ${v.paid})` : ""}`, strong: true },
          v.promo ? { label: "Promo", value: v.promo } : null,
          v.giftCardUsed ? { label: "Gift card used", value: v.giftCardUsed } : null,
          v.cancelReason || v.cancelledBy
            ? { label: "Cancelled", value: [v.cancelledBy ? `by ${v.cancelledBy}` : null, v.cancelReason].filter(Boolean).join(": ") }
            : null,
        ]}
      />
      <Actions>
        <Btn href={v.adminUrl}>Open booking</Btn>
        {v.contactEmail ? (
          <>
            <Gap />
            <Btn href={`mailto:${v.contactEmail}?subject=${encodeURIComponent(`Your Raw Planet session (${v.code})`)}`} variant="secondary">
              Email guest
            </Btn>
          </>
        ) : null}
      </Actions>
      {v.kind === "cancelled" ? <P small muted>The time is open on the site again, and anyone on the waitlist for that day has been emailed.</P> : null}
    </Layout>
  );
  return { subject, element };
}

/* ------------------------------------------------------------------ */

export type DigestSession = {
  id: string;
  time: string;
  experienceName: string;
  theme: string;
  contactName: string;
  guests: number;
  sourceLabel: string;
  phone: string | null;
  notes: string | null;
  flags: string[];
  adminUrl: string;
};

export type HostDigestView = {
  /** "Wednesday, November 4" */
  dateLabel: string;
  today: DigestSession[];
  tomorrow: DigestSession[];
  tomorrowLabel: string;
  stats: { label: string; value: string }[];
  attention: { text: string; url: string }[];
  adminUrl: string;
  calendarUrl: string;
};

function SessionRow({ s }: { s: DigestSession }) {
  const accent = accentFor(s.theme);
  return (
    <Row style={{ borderTop: `1px solid ${C.line}` }}>
      <Column style={{ width: "76px", verticalAlign: "top", padding: "12px 10px 12px 0" }}>
        <Text style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: "20px", lineHeight: "22px", fontWeight: 800, color: C.cocoa }}>{s.time}</Text>
      </Column>
      <Column style={{ verticalAlign: "top", padding: "12px 0", borderLeft: `4px solid ${accent.strong}`, paddingLeft: "12px" }}>
        <Text style={{ margin: 0, fontFamily: FONT_BODY, fontSize: "15px", lineHeight: "21px", fontWeight: 700, color: C.cocoa }}>
          <a href={s.adminUrl} style={{ color: C.cocoa, textDecoration: "none" }}>
            {s.contactName} · {s.guests}
          </a>
        </Text>
        <Text style={{ margin: "2px 0 0", fontFamily: FONT_BODY, fontSize: "13px", lineHeight: "19px", color: C.inkSoft }}>
          {s.experienceName} · {s.sourceLabel}
          {s.phone ? (
            <>
              {" · "}
              <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} style={{ color: C.brick }}>
                {s.phone}
              </a>
            </>
          ) : null}
        </Text>
        {s.flags.length ? (
          <Text style={{ margin: "4px 0 0", fontFamily: FONT_BODY, fontSize: "13px", lineHeight: "19px", color: C.brick, fontWeight: 700 }}>{s.flags.join(" · ")}</Text>
        ) : null}
        {s.notes ? (
          <Text style={{ margin: "4px 0 0", fontFamily: FONT_BODY, fontSize: "13px", lineHeight: "19px", color: C.cocoa, fontStyle: "italic" }}>“{s.notes}”</Text>
        ) : null}
      </Column>
    </Row>
  );
}

function SessionList({ items, empty }: { items: DigestSession[]; empty: string }) {
  if (!items.length) return <P muted small>{empty}</P>;
  return (
    <Section style={{ margin: "0 0 8px", borderBottom: `1px solid ${C.line}` }}>
      {items.map((s) => (
        <SessionRow key={s.id} s={s} />
      ))}
    </Section>
  );
}

function StatRow({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <Section>
      <Row>
        {stats.map((s) => (
          <Column key={s.label} style={{ verticalAlign: "top", paddingRight: "8px" }}>
            <Text style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: "26px", lineHeight: "28px", fontWeight: 800, color: C.cocoa }}>{s.value}</Text>
            <Text style={{ margin: "2px 0 0", fontFamily: FONT_BODY, fontSize: "11px", lineHeight: "14px", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, color: C.inkFaint }}>
              {s.label}
            </Text>
          </Column>
        ))}
      </Row>
    </Section>
  );
}

export function hostDigestEmail(v: HostDigestView): EmailOutput {
  const n = v.today.length;
  const subject = n ? `Today: ${n} session${n === 1 ? "" : "s"}, first at ${v.today[0].time}` : `Today: no sessions${v.tomorrow.length ? `, ${v.tomorrow.length} tomorrow` : ""}`;
  const preview = [
    n ? v.today.map((s) => `${s.time} ${s.contactName}`).join(", ") : "A free day.",
    v.attention.length ? `${v.attention.length} thing${v.attention.length === 1 ? "" : "s"} need you.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const element = (
    <Layout lang="en" audience="host" preview={preview}>
      <P small muted style={{ margin: "0 0 4px" }}>
        Good morning, Alex
      </P>
      <H1>{v.dateLabel}</H1>
      {v.attention.length ? (
        <Panel bg={C.warningSoft}>
          <P style={{ margin: "0 0 6px", fontWeight: 700 }}>Needs you</P>
          {v.attention.map((a, i) => (
            <P key={i} small style={{ margin: "0 0 4px" }}>
              → <A href={a.url}>{a.text}</A>
            </P>
          ))}
        </Panel>
      ) : null}
      <H2>Today</H2>
      <SessionList items={v.today} empty="No sessions today." />
      <H2>{v.tomorrowLabel}</H2>
      <SessionList items={v.tomorrow} empty="Nothing booked yet." />
      {v.stats.length ? (
        <>
          <Divider />
          <StatRow stats={v.stats} />
        </>
      ) : null}
      <Actions>
        <Btn href={v.adminUrl}>Open today</Btn>
        <Gap />
        <Btn href={v.calendarUrl} variant="secondary">
          Calendar
        </Btn>
      </Actions>
    </Layout>
  );
  return { subject, element };
}

export type HostWeeklyReportView = {
  /** "Oct 26 to Nov 1" */
  weekLabel: string;
  netRevenue: string;
  sessions: number;
  stats: { label: string; value: string }[];
  notes: string[];
  reportUrl: string;
};

export function hostWeeklyReportEmail(v: HostWeeklyReportView): EmailOutput {
  const subject = `Last week: ${v.netRevenue} received, ${v.sessions} session${v.sessions === 1 ? "" : "s"}`;
  const element = (
    <Layout lang="en" audience="host" preview={`${v.weekLabel}. ${v.notes[0] ?? ""}`}>
      <P small muted style={{ margin: "0 0 4px" }}>
        Your week, Alex
      </P>
      <H1>{v.weekLabel}</H1>
      <StatRow stats={v.stats} />
      {v.notes.length ? <Divider /> : null}
      {v.notes.map((n, i) => (
        <P key={i} small style={{ margin: "0 0 4px" }}>
          {n}
        </P>
      ))}
      <Actions>
        <Btn href={v.reportUrl}>See the full report</Btn>
      </Actions>
    </Layout>
  );
  return { subject, element };
}
