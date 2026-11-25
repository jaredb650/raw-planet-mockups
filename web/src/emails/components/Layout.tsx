import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { BUSINESS, siteUrl } from "@/lib/config";
import type { Lang } from "../i18n";
import { accentFor, C, FONT_BODY, FONT_DISPLAY } from "../theme";

const instagramHandle = "@" + BUSINESS.instagram.replace(/\/$/, "").split("/").pop();

export type LayoutProps = {
  lang: Lang;
  /** Experience theme for the accent stripe ("production" | "dj" | "wellness"), default brand purple. */
  theme?: string | null;
  /** Inbox preview line (shown after the subject in most clients). */
  preview: string;
  /** Adds a "Manage your booking" link to the footer. */
  manageUrl?: string | null;
  /** Host-facing emails get a compact, utilitarian footer. */
  audience?: "guest" | "host";
  children: ReactNode;
};

const footerCopy = {
  en: {
    tagline: "Music production, DJ and meditation experiences in New York City.",
    reply: "Questions? Just reply to this email. It goes straight to Alex.",
    manage: "Manage your booking",
    langs: "Sessions in English & Spanish",
  },
  es: {
    tagline: "Experiencias de producción musical, DJ y meditación en Nueva York.",
    reply: "¿Dudas? Responde a este correo y le llega directo a Alex.",
    manage: "Gestionar tu reserva",
    langs: "Sesiones en inglés y español",
  },
};

export function Layout({ lang, theme, preview, manageUrl, audience = "guest", children }: LayoutProps) {
  const accent = accentFor(theme);
  const f = footerCopy[lang];
  const logoSrc = siteUrl("/brand/logo-purple.png");
  return (
    <Html lang={lang} dir="ltr">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="x-apple-disable-message-reformatting" />
        {/* Clients that load web fonts (Apple Mail, iOS, webmail previews) get the current brand faces; others fall back cleanly. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- email <head>, not a Next page */}
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @media only screen and (max-width: 480px) {
            .rp-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .rp-h1 { font-size: 21px !important; line-height: 27px !important; }
            .rp-wordmark { font-size: 16px !important; line-height: 20px !important; }
          }
          a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "24px 12px", backgroundColor: C.canvas, fontFamily: FONT_BODY, color: C.cocoa }}>
        <Container
          style={{
            width: "100%",
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: C.paper,
            borderRadius: "20px",
            border: `1px solid ${C.line}`,
            overflow: "hidden",
          }}
        >
          {/* Top brand accent bar */}
          <Section style={{ backgroundColor: accent.strong, height: "6px", lineHeight: "6px", fontSize: "1px" }}>&nbsp;</Section>

          {/* Header: crisp white with purple logo mark and wide Unbounded wordmark */}
          <Section className="rp-pad" style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.line}`, padding: "20px 32px 18px" }}>
            <Link href={siteUrl(audience === "host" ? "/admin" : "/")} style={{ textDecoration: "none", display: "block" }}>
              <Row>
                <Column style={{ width: "48px", verticalAlign: "middle" }}>
                  <Img src={logoSrc} alt="Raw Planet" width={38} height={43} style={{ display: "block" }} />
                </Column>
                <Column style={{ verticalAlign: "middle", paddingLeft: "6px" }}>
                  <Text
                    className="rp-wordmark"
                    style={{
                      margin: 0,
                      fontFamily: FONT_DISPLAY,
                      fontSize: "18px",
                      lineHeight: "22px",
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                      color: C.purple,
                      textTransform: "uppercase",
                    }}
                  >
                    Raw Planet
                  </Text>
                  <Text
                    style={{
                      margin: "3px 0 0",
                      fontFamily: FONT_DISPLAY,
                      fontSize: "9.5px",
                      lineHeight: "13px",
                      fontWeight: 600,
                      letterSpacing: "2.2px",
                      color: C.inkFaint,
                      textTransform: "uppercase",
                    }}
                  >
                    {audience === "host" ? "Host desk" : "Experiences · New York City"}
                  </Text>
                </Column>
              </Row>
            </Link>
          </Section>

          <Section className="rp-pad" style={{ padding: "32px 32px 16px", backgroundColor: C.white }}>
            {children}
          </Section>

          {/* Footer */}
          <Section className="rp-pad" style={{ backgroundColor: C.mist, borderTop: `1px solid ${C.line}`, padding: "22px 32px 26px" }}>
            {audience === "guest" ? (
              <>
                {manageUrl ? (
                  <Text style={footText}>
                    <Link href={manageUrl} style={footLink}>
                      {f.manage} →
                    </Link>
                  </Text>
                ) : null}
                <Text style={footText}>{f.reply}</Text>
                <Text style={footText}>
                  <Link href={`mailto:${BUSINESS.contactEmail}`} style={footLink}>
                    {BUSINESS.contactEmail}
                  </Link>
                  {"  ·  "}
                  <Link href={BUSINESS.instagram} style={footLink}>
                    Instagram {instagramHandle}
                  </Link>
                </Text>
                <Text style={{ ...footText, color: C.inkFaint, fontSize: "12px", margin: "12px 0 0" }}>
                  {BUSINESS.name} · {f.tagline} {f.langs}.
                  <br />
                  {BUSINESS.legalName} · {BUSINESS.city}
                </Text>
              </>
            ) : (
              <Text style={{ ...footText, color: C.inkFaint, fontSize: "12px", margin: 0 }}>
                Sent automatically by your booking site. Times are New York time.
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const footText = { margin: "0 0 6px", fontFamily: FONT_BODY, fontSize: "13px", lineHeight: "20px", color: C.inkSoft } as const;
const footLink = { color: C.purple, fontWeight: 700, textDecoration: "underline" } as const;
