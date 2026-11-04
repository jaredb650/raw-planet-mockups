import { Body, Container, Head, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { BUSINESS, siteUrl } from "@/lib/config";
import type { Lang } from "../i18n";
import { accentFor, C, FONT_BODY, FONT_DISPLAY } from "../theme";

const instagramHandle = "@" + BUSINESS.instagram.replace(/\/$/, "").split("/").pop();

export type LayoutProps = {
  lang: Lang;
  /** Experience theme for the accent stripe ("production" | "dj" | "wellness"), default brand brick. */
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
    tagline: "Private music production, DJ and sound meditation sessions in New York City.",
    reply: "Questions? Just reply to this email. It goes straight to Alex.",
    manage: "Manage your booking",
    langs: "Sessions in English & Spanish",
  },
  es: {
    tagline: "Sesiones privadas de producción musical, DJ y meditación con sonido en Nueva York.",
    reply: "¿Dudas? Responde a este correo y le llega directo a Alex.",
    manage: "Gestionar tu reserva",
    langs: "Sesiones en inglés y español",
  },
};

export function Layout({ lang, theme, preview, manageUrl, audience = "guest", children }: LayoutProps) {
  const accent = accentFor(theme);
  const f = footerCopy[lang];
  return (
    <Html lang={lang} dir="ltr">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="x-apple-disable-message-reformatting" />
        {/* Optional: clients that load web fonts (Apple Mail, iOS) get the brand faces; others use the fallbacks. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- email <head>, not a Next page */}
        <link
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @media only screen and (max-width: 480px) {
            .rp-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .rp-h1 { font-size: 34px !important; line-height: 36px !important; }
            .rp-wordmark { font-size: 26px !important; }
          }
          a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "24px 0", backgroundColor: C.cream, fontFamily: FONT_BODY, color: C.cocoa }}>
        <Container style={{ width: "100%", maxWidth: "600px", margin: "0 auto", backgroundColor: C.paper, borderRadius: "20px", overflow: "hidden" }}>
          {/* Header: wordmark on cocoa, then the experience accent stripe */}
          <Section className="rp-pad" style={{ backgroundColor: C.cocoa, padding: "22px 32px 20px" }}>
            <Link href={siteUrl(audience === "host" ? "/admin" : "/")} style={{ textDecoration: "none" }}>
              <Text
                className="rp-wordmark"
                style={{
                  margin: 0,
                  fontFamily: FONT_DISPLAY,
                  fontSize: "30px",
                  lineHeight: "30px",
                  fontWeight: 800,
                  letterSpacing: "3px",
                  color: C.cream,
                  textTransform: "uppercase",
                }}
              >
                Raw Planet
              </Text>
              <Text
                style={{
                  margin: "6px 0 0",
                  fontFamily: FONT_BODY,
                  fontSize: "11px",
                  lineHeight: "14px",
                  fontWeight: 700,
                  letterSpacing: "3px",
                  color: accent.strong,
                  textTransform: "uppercase",
                }}
              >
                {audience === "host" ? "Host desk" : "Experiences · New York City"}
              </Text>
            </Link>
          </Section>
          <Section style={{ backgroundColor: accent.strong, height: "6px", lineHeight: "6px", fontSize: "1px" }}>&nbsp;</Section>

          <Section className="rp-pad" style={{ padding: "32px 32px 12px" }}>
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
const footLink = { color: C.cocoa, fontWeight: 700, textDecoration: "underline" } as const;
