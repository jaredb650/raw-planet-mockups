/** Inquiry (group / private event / corporate / press) auto-reply and host alert. */
import { Layout } from "../components/Layout";
import { A, Actions, Btn, Details, Eyebrow, Gap, H1, NoteFromAlex, P, Panel, Pill } from "../components/ui";
import { signoff } from "../copy";
import { firstName, type Lang } from "../i18n";
import { ACCENTS, C } from "../theme";
import type { EmailOutput } from "../types";

export type InquiryKind = "group" | "private_event" | "corporate" | "general" | "press";

export type InquiryView = {
  lang: Lang;
  id: string;
  kind: InquiryKind;
  name: string;
  email: string;
  phone: string | null;
  experienceName: string | null;
  theme: string | null;
  /** Pre-formatted preferred date (free text passes through). */
  preferredDate: string | null;
  groupSize: number | null;
  message: string;
  receivedLabel: string;
  adminUrl: string;
  faqUrl: string;
  bookUrl: string;
};

const KIND: Record<InquiryKind, { en: string; es: string }> = {
  group: { en: "Group booking", es: "Reserva de grupo" },
  private_event: { en: "Private event", es: "Evento privado" },
  corporate: { en: "Team / corporate", es: "Empresa / equipo" },
  general: { en: "Question", es: "Consulta" },
  press: { en: "Press", es: "Prensa" },
};

export function inquiryAutoReplyEmail(v: InquiryView): EmailOutput {
  const es = v.lang === "es";
  const subject = es ? "Recibimos tu mensaje. Alex te responde pronto" : "Got it! Alex will get back to you soon";
  const preview = es ? "Normalmente respondemos en menos de un día." : "We usually reply within a day.";
  const element = (
    <Layout lang={v.lang} theme={v.theme} preview={preview}>
      <Eyebrow>{KIND[v.kind][v.lang]}</Eyebrow>
      {/* Goes to an unverified address: no free text (name/message) echoed back, so the form can't relay spam. */}
      <H1>{es ? "¡Gracias por escribir!" : "Thanks for reaching out!"}</H1>
      <P>
        {es
          ? "Recibimos tu mensaje y le llegó directo a Alex. Normalmente responde en menos de un día (a veces más rápido, si no está en medio de una sesión)."
          : "Your message landed straight in Alex's inbox. He usually replies within a day, often faster if he's not mid-session."}
      </P>
      <Details
        rows={[
          v.experienceName ? { label: es ? "Experiencia" : "Experience", value: v.experienceName } : null,
          v.preferredDate ? { label: es ? "Fecha" : "Date", value: v.preferredDate } : null,
          v.groupSize ? { label: es ? "Tamaño del grupo" : "Group size", value: String(v.groupSize) } : null,
        ]}
      />
      <P>
        {es ? (
          <>Mientras tanto, quizá encuentres tu respuesta en las <A href={v.faqUrl}>preguntas frecuentes</A>. Y si tu grupo cabe en una sesión normal, puedes <A href={v.bookUrl}>reservar directamente</A>.</>
        ) : (
          <>Meanwhile, your answer might already be in the <A href={v.faqUrl}>FAQ</A>. And if your group fits a regular session, you can <A href={v.bookUrl}>book it directly</A>.</>
        )}
      </P>
      <P small muted>{es ? "¿Quieres añadir algo? Responde a este correo." : "Want to add something? Just reply to this email."}</P>
      <NoteFromAlex accent={ACCENTS.brand.strong} signoff={signoff(v.lang)}>
        {es ? "¡Qué bueno que escribiste! Hablamos pronto." : "Really glad you reached out. Talk soon."}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function inquiryHostAlertEmail(v: InquiryView): EmailOutput {
  const subject = `[Inquiry] ${KIND[v.kind].en}: ${v.name}${v.groupSize ? ` (${v.groupSize})` : ""}${v.preferredDate ? ` · ${v.preferredDate}` : ""}`;
  const reply = `mailto:${v.email}?subject=${encodeURIComponent(v.lang === "es" ? "Tu consulta en Raw Planet" : "Your Raw Planet inquiry")}`;
  const element = (
    <Layout lang="en" audience="host" preview={`${v.name}: ${v.message.slice(0, 90)}`}>
      <div style={{ marginBottom: "12px" }}>
        <Pill bg={ACCENTS.brand.soft}>{KIND[v.kind].en}</Pill>
        {v.lang === "es" ? (
          <>
            {" "}
            <Pill bg={C.powder}>Prefers Spanish</Pill>
          </>
        ) : null}
      </div>
      <H1>{v.name}</H1>
      <P muted small>Received {v.receivedLabel}. They got an automatic “we’ll reply soon” email.</P>
      <Details
        rows={[
          { label: "Email", value: <A href={reply}>{v.email}</A> },
          v.phone ? { label: "Phone", value: <A href={`tel:${v.phone.replace(/[^\d+]/g, "")}`}>{v.phone}</A> } : null,
          v.experienceName ? { label: "Experience", value: v.experienceName } : null,
          v.preferredDate ? { label: "Preferred date", value: v.preferredDate } : null,
          v.groupSize ? { label: "Group size", value: String(v.groupSize), strong: true } : null,
        ]}
      />
      {v.message ? (
        <Panel bg={C.mist} border={C.line}>
          <P style={{ margin: 0, whiteSpace: "pre-line" }}>{v.message}</P>
        </Panel>
      ) : null}
      <Actions>
        <Btn href={reply}>Reply to {firstName(v.name)}</Btn>
        <Gap />
        <Btn href={v.adminUrl} variant="secondary">
          Open in admin
        </Btn>
      </Actions>
    </Layout>
  );
  return { subject, element };
}
