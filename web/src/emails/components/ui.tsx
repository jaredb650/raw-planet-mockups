/**
 * Email building blocks. Inline styles + tables only (via react-email), so
 * they render the same in Gmail, Apple Mail and Outlook.
 */
import { Button, Column, Heading, Hr, Link, Row, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { C, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../theme";

export function Eyebrow({ children, color = C.purple }: { children: ReactNode; color?: string }) {
  return (
    <Text
      style={{
        margin: "0 0 10px",
        fontFamily: FONT_DISPLAY,
        fontSize: "10.5px",
        lineHeight: "15px",
        letterSpacing: "2.2px",
        textTransform: "uppercase",
        fontWeight: 600,
        color,
      }}
    >
      {children}
    </Text>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      className="rp-h1"
      style={{
        margin: "0 0 16px",
        fontFamily: FONT_DISPLAY,
        fontSize: "25px",
        lineHeight: "31px",
        fontWeight: 800,
        letterSpacing: "-0.3px",
        textTransform: "uppercase",
        color: C.cocoa,
      }}
    >
      {children}
    </Heading>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{
        margin: "28px 0 10px",
        fontFamily: FONT_DISPLAY,
        fontSize: "16px",
        lineHeight: "22px",
        fontWeight: 800,
        letterSpacing: "-0.2px",
        textTransform: "uppercase",
        color: C.cocoa,
      }}
    >
      {children}
    </Heading>
  );
}

export function P({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: CSSProperties }) {
  return (
    <Text
      style={{
        margin: "0 0 14px",
        fontFamily: FONT_BODY,
        fontSize: small ? "14px" : "16px",
        lineHeight: small ? "22px" : "26px",
        color: muted ? C.inkSoft : C.cocoa,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

export function A({ href, children, color = C.purple }: { href: string; children: ReactNode; color?: string }) {
  return (
    <Link href={href} style={{ color, textDecoration: "underline", fontWeight: 600 }}>
      {children}
    </Link>
  );
}

export function Btn({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const primary = variant === "primary";
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: primary ? C.purple : C.white,
        color: primary ? C.white : C.purple,
        border: `2px solid ${C.purple}`,
        borderRadius: "12px",
        padding: "13px 26px",
        fontFamily: FONT_BODY,
        fontSize: "16px",
        lineHeight: "20px",
        fontWeight: 700,
        textDecoration: "none",
        textAlign: "center",
      }}
    >
      {children}
    </Button>
  );
}

/** One or two buttons side by side (stack naturally on narrow screens). */
export function Actions({ children }: { children: ReactNode }) {
  return <Section style={{ margin: "22px 0 8px" }}>{children}</Section>;
}

export function Gap({ w = 10 }: { w?: number }) {
  return <span style={{ display: "inline-block", width: `${w}px`, height: "10px" }}>&nbsp;</span>;
}

/** A soft rounded panel, tinted with subtle lavender by default. */
export function Panel({ children, bg = C.mist, border = C.line }: { children: ReactNode; bg?: string; border?: string }) {
  return (
    <Section
      style={{
        backgroundColor: bg,
        borderRadius: "14px",
        border: border ? `1px solid ${border}` : undefined,
        padding: "18px 20px",
        margin: "18px 0",
      }}
    >
      {children}
    </Section>
  );
}

export type DetailRow = { label: string; value: ReactNode; strong?: boolean } | null | false | undefined;

/** Label / value list (When, Where, Guests…). */
export function Details({ rows, bg = C.mist, accent }: { rows: DetailRow[]; bg?: string; accent?: string }) {
  const list = rows.filter(Boolean) as { label: string; value: ReactNode; strong?: boolean }[];
  return (
    <Section
      style={{
        backgroundColor: bg,
        borderRadius: "14px",
        border: `1px solid ${C.line}`,
        borderLeft: accent ? `5px solid ${accent}` : `1px solid ${C.line}`,
        padding: "6px 20px",
        margin: "18px 0",
      }}
    >
      {list.map((r, i) => (
        <Row key={i} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
          <Column style={{ padding: "12px 0 0", verticalAlign: "top" }}>
            <Text
              style={{
                margin: 0,
                fontFamily: FONT_BODY,
                fontSize: "11px",
                lineHeight: "14px",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                fontWeight: 700,
                color: C.inkFaint,
              }}
            >
              {r.label}
            </Text>
            <Text
              style={{
                margin: "3px 0 12px",
                fontFamily: FONT_BODY,
                fontSize: "16px",
                lineHeight: "23px",
                fontWeight: r.strong ? 700 : 500,
                color: C.cocoa,
              }}
            >
              {r.value}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

export type PriceLine = { label: string; amount: string; muted?: boolean };

export function PriceTable({ lines, totalLabel, total }: { lines: PriceLine[]; totalLabel: string; total: string }) {
  const cell = { fontFamily: FONT_BODY, fontSize: "15px", lineHeight: "22px", padding: "5px 0" } as const;
  return (
    <Section style={{ margin: "8px 0 18px" }}>
      {lines.map((l, i) => (
        <Row key={i}>
          <Column style={{ ...cell, color: l.muted ? C.inkSoft : C.cocoa }}>{l.label}</Column>
          <Column style={{ ...cell, color: l.muted ? C.inkSoft : C.cocoa, textAlign: "right", whiteSpace: "nowrap" }}>{l.amount}</Column>
        </Row>
      ))}
      <Row>
        <Column style={{ ...cell, borderTop: `2px solid ${C.purple}`, paddingTop: "10px", fontWeight: 700, color: C.cocoa }}>{totalLabel}</Column>
        <Column
          style={{ ...cell, borderTop: `2px solid ${C.purple}`, paddingTop: "10px", fontWeight: 700, color: C.cocoa, textAlign: "right", whiteSpace: "nowrap" }}
        >
          {total}
        </Column>
      </Row>
    </Section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <Section style={{ margin: "0 0 12px" }}>
      {items.map((it, i) => (
        <Row key={i}>
          <Column style={{ width: "22px", verticalAlign: "top", fontFamily: FONT_BODY, fontSize: "16px", lineHeight: "26px", color: C.purple, fontWeight: 700 }}>
            ✓
          </Column>
          <Column style={{ verticalAlign: "top", fontFamily: FONT_BODY, fontSize: "16px", lineHeight: "26px", color: C.cocoa, paddingBottom: "4px" }}>
            {it}
          </Column>
        </Row>
      ))}
    </Section>
  );
}

export function Divider() {
  return <Hr style={{ borderColor: C.line, borderTopWidth: "1px", margin: "26px 0" }} />;
}

/** A personal note from Alex, with his sign-off. */
export function NoteFromAlex({ children, accent, signoff }: { children: ReactNode; accent: string; signoff: string }) {
  return (
    <Section style={{ margin: "26px 0 6px", borderLeft: `4px solid ${accent}`, paddingLeft: "16px" }}>
      <Text style={{ margin: "0 0 10px", fontFamily: FONT_BODY, fontSize: "16px", lineHeight: "26px", color: C.cocoa, fontStyle: "italic" }}>
        {children}
      </Text>
      <Text style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: "16px", lineHeight: "20px", fontWeight: 800, color: C.purple, textTransform: "uppercase" }}>
        — Alex
      </Text>
      <Text style={{ margin: "4px 0 0", fontFamily: FONT_BODY, fontSize: "13px", lineHeight: "18px", color: C.inkSoft }}>{signoff}</Text>
    </Section>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: FONT_MONO, fontSize: "15px", letterSpacing: "1px", fontWeight: 700 }}>{children}</span>;
}

/** Short "status" pill for host emails. */
export function Pill({ children, bg, color = C.cocoa }: { children: ReactNode; bg: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: bg,
        color,
        borderRadius: "999px",
        padding: "4px 12px",
        fontFamily: FONT_BODY,
        fontSize: "12px",
        lineHeight: "16px",
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}
