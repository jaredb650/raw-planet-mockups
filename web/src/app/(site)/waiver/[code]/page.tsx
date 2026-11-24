import type { Metadata } from "next";
import Link from "next/link";
import { getExperienceSummary } from "@/components/site/queries";
import { WaiverForm } from "@/components/site/WaiverForm";
import { experienceName, fmtDayYear, fmtRange, langOf } from "@/emails/i18n";
import { signingState, WAIVER_COPY, type WaiverLang } from "@/lib/waiver";
import { countWaivers, getBookingForWaiver } from "@/lib/waiver-token";
import styles from "./waiver.module.css";

export const metadata: Metadata = {
  title: "Sign your waiver",
  robots: { index: false, follow: false },
};

export default async function WaiverPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : "";
  const booking = token ? await getBookingForWaiver(code, token) : undefined;
  const picked = sp.lang === "es" || sp.lang === "en" ? (sp.lang as WaiverLang) : null;

  if (!booking) {
    const t = WAIVER_COPY[picked ?? "en"].ui;
    return (
      <Shell lang={picked ?? "en"} title={t.badTitle}>
        <p className="lede">{t.badBody}</p>
        <Link href="/contact" className="link">{t.contact}</Link>
      </Shell>
    );
  }

  const lang = picked ?? langOf(booking.language);
  const c = WAIVER_COPY[lang];
  const t = c.ui;
  const [exp, signed] = await Promise.all([getExperienceSummary(booking.experienceId), countWaivers(booking.id)]);
  const state = signingState(booking, signed);

  if (state !== "open") {
    return (
      <Shell lang={lang} theme={exp?.theme} title={state === "full" ? t.fullTitle : t.closedTitle}>
        <p className="lede">{state === "full" ? t.fullBody : t.closedBody}</p>
        <Link href="/contact" className="link">{t.contact}</Link>
      </Shell>
    );
  }

  // Shared with the whole group, so this page shows the session and never the booker's or other guests' details.
  const session = `${exp ? experienceName(exp, lang) : "Raw Planet"} · ${fmtDayYear(booking.startAt, lang)}, ${fmtRange(booking.startAt, booking.endAt, lang)}`;
  return (
    <Shell lang={lang} theme={exp?.theme} title={t.pageTitle} eyebrow={session}>
      <p className="lede">{t.each}</p>
      <p className={styles.lang}>
        <Link
          href={`/waiver/${booking.code}?t=${encodeURIComponent(token)}&lang=${lang === "es" ? "en" : "es"}`}
          hrefLang={lang === "es" ? "en" : "es"}
          lang={lang === "es" ? "en" : "es"}
          className="link"
        >
          {t.otherLang}
        </Link>
      </p>
      <div className={styles.card}>
        <div className={styles.doc}>
          <h2>{c.title}</h2>
          <p>{c.intro}</p>
          {c.sections.map((s) => (
            <section key={s.heading}>
              <h3>{s.heading}</h3>
              <p>{s.body}</p>
            </section>
          ))}
          <section>
            <h3>{c.recording.heading}</h3>
            <p>{c.recording.body}</p>
          </section>
          <section>
            <h3>{c.minor.heading}</h3>
            <p>{c.minor.body}</p>
          </section>
        </div>
        <WaiverForm code={booking.code} token={token} lang={lang} guests={booking.guests} signed={signed} />
      </div>
    </Shell>
  );
}

function Shell({ lang, title, eyebrow, theme, children }: { lang: WaiverLang; title: string; eyebrow?: string; theme?: string; children: React.ReactNode }) {
  return (
    <section className={styles.page} data-theme={theme} aria-labelledby="waiver-title" lang={lang}>
      <div className="wrap-narrow">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 id="waiver-title" className={styles.title}>
          {title}
        </h1>
        {children}
      </div>
    </section>
  );
}
