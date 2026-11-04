/** Gift card emails: the purchaser's receipt and the card itself for the recipient (EN + ES). */
import { Section, Text } from "@react-email/components";
import { Layout } from "../components/Layout";
import { A, Actions, Btn, Bullets, Eyebrow, H1, H2, NoteFromAlex, P, Panel } from "../components/ui";
import { signoff } from "../copy";
import { firstName, type Lang } from "../i18n";
import { ACCENTS, C, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../theme";
import type { EmailOutput } from "../types";

export type GiftCardView = {
  lang: Lang;
  code: string;
  amount: string;
  purchaserName: string;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
  /** "Friday, December 25" when the card is scheduled for later (null = sent now / no recipient email). */
  scheduledLabel: string | null;
  issuedByAdmin: boolean;
  bookUrl: string;
  giftCardsUrl: string;
};

/** The card itself: cocoa ticket with amount + code. */
function CardTicket({ v }: { v: GiftCardView }) {
  const es = v.lang === "es";
  return (
    <Section style={{ backgroundColor: C.cocoa, borderRadius: "18px", padding: "24px 24px 22px", margin: "20px 0" }}>
      <Text style={{ margin: 0, fontFamily: FONT_BODY, fontSize: "11px", lineHeight: "14px", letterSpacing: "3px", fontWeight: 700, color: C.ochre, textTransform: "uppercase" }}>
        {es ? "Tarjeta de regalo Raw Planet" : "Raw Planet gift card"}
      </Text>
      <Text style={{ margin: "8px 0 14px", fontFamily: FONT_DISPLAY, fontSize: "56px", lineHeight: "56px", fontWeight: 800, color: C.cream }}>{v.amount}</Text>
      <Text style={{ margin: 0, fontFamily: FONT_BODY, fontSize: "11px", lineHeight: "14px", letterSpacing: "1.5px", fontWeight: 700, color: C.powder, textTransform: "uppercase" }}>
        {es ? "Código" : "Code"}
      </Text>
      <Text style={{ margin: "4px 0 0", fontFamily: FONT_MONO, fontSize: "20px", lineHeight: "26px", letterSpacing: "2px", fontWeight: 700, color: C.white }}>{v.code}</Text>
      <Section style={{ height: "6px", lineHeight: "6px", fontSize: "1px", marginTop: "18px", backgroundColor: ACCENTS.production.strong, borderRadius: "3px" }}>&nbsp;</Section>
    </Section>
  );
}

function HowToUse({ v }: { v: GiftCardView }) {
  const es = v.lang === "es";
  return (
    <>
      <H2>{es ? "Cómo usarla" : "How to use it"}</H2>
      <Bullets
        items={
          es
            ? [
                "Elige una sesión de producción musical, DJ o meditación con sonido y un horario.",
                "En el pago, escribe el código en «Tarjeta de regalo». Si sobra saldo, queda para la próxima.",
                "No caduca y se puede usar en varias reservas.",
              ]
            : [
                "Pick a music production, DJ or sound meditation session and a time.",
                "At checkout, enter the code under “Gift card”. Any leftover balance stays on the card.",
                "It never expires and works across several bookings.",
              ]
        }
      />
    </>
  );
}

export function giftCardReceiptEmail(v: GiftCardView): EmailOutput {
  const es = v.lang === "es";
  const who = v.recipientName ?? (es ? "alguien especial" : "someone special");
  const subject = v.issuedByAdmin
    ? es
      ? `Tu tarjeta de regalo Raw Planet de ${v.amount}`
      : `Your ${v.amount} Raw Planet gift card`
    : es
      ? `Recibo: tarjeta de regalo de ${v.amount}`
      : `Receipt: ${v.amount} gift card${v.recipientName ? ` for ${v.recipientName}` : ""}`;
  const preview = v.recipientEmail
    ? v.scheduledLabel
      ? es
        ? `Se la enviaremos a ${who} el ${v.scheduledLabel}.`
        : `We'll email it to ${who} on ${v.scheduledLabel}.`
      : es
        ? `Ya se la enviamos a ${who}.`
        : `It's on its way to ${who}.`
    : es
      ? `Código ${v.code}: reenvíalo, imprímelo o úsalo tú.`
      : `Code ${v.code}: forward it, print it, or use it yourself.`;
  const element = (
    <Layout lang={v.lang} theme="production" preview={preview}>
      <Eyebrow>{v.issuedByAdmin ? (es ? "Tarjeta de regalo" : "Gift card") : es ? "Compra confirmada" : "Purchase confirmed"}</Eyebrow>
      <H1>{v.issuedByAdmin ? (es ? "Un regalo de Raw Planet" : "A gift from Raw Planet") : es ? "¡Qué buen regalo!" : "Great gift."}</H1>
      {v.recipientEmail ? (
        <P>
          {v.scheduledLabel
            ? es
              ? <>Gracias, {firstName(v.purchaserName)}. Le enviaremos la tarjeta a <strong>{who}</strong> ({v.recipientEmail}) el <strong>{v.scheduledLabel}</strong> por la mañana{v.message ? ", junto con tu mensaje" : ""}.</>
              : <>Thanks, {firstName(v.purchaserName)}. We’ll email the card to <strong>{who}</strong> ({v.recipientEmail}) on the morning of <strong>{v.scheduledLabel}</strong>{v.message ? ", along with your message" : ""}.</>
            : es
              ? <>Gracias, {firstName(v.purchaserName)}. Ya le enviamos la tarjeta a <strong>{who}</strong> ({v.recipientEmail}){v.message ? " con tu mensaje" : ""}.</>
              : <>Thanks, {firstName(v.purchaserName)}. We’ve emailed the card to <strong>{who}</strong> ({v.recipientEmail}){v.message ? " with your message" : ""}.</>}
        </P>
      ) : (
        <P>
          {es
            ? `Gracias, ${firstName(v.purchaserName)}. Aquí está la tarjeta: reenvía este correo, imprímelo o escribe el código en una tarjeta tuya.`
            : `Thanks, ${firstName(v.purchaserName)}. Here's the card: forward this email, print it, or write the code in a card of your own.`}
        </P>
      )}
      <CardTicket v={v} />
      {v.recipientEmail ? (
        <P small muted>
          {es
            ? "Te dejamos el código por si el correo se pierde o prefieres dárselo en persona."
            : "The code is here too, in case the email goes astray or you'd rather hand it over in person."}
        </P>
      ) : null}
      {v.message ? (
        <Panel bg={ACCENTS.production.soft}>
          <P small muted style={{ margin: "0 0 4px" }}>{es ? "Tu mensaje" : "Your message"}</P>
          <P style={{ margin: 0, fontStyle: "italic" }}>“{v.message}”</P>
        </Panel>
      ) : null}
      <HowToUse v={v} />
      <P small muted>
        {es ? (
          <>Consulta el saldo cuando quieras en <A href={v.giftCardsUrl}>la página de tarjetas de regalo</A>. Guarda este correo como comprobante.</>
        ) : (
          <>Check the balance anytime on <A href={v.giftCardsUrl}>the gift cards page</A>. Keep this email as your receipt.</>
        )}
      </P>
      <NoteFromAlex accent={ACCENTS.production.strong} signoff={signoff(v.lang)}>
        {es ? "Gracias por regalar música. Voy a hacer que valga la pena." : "Thanks for gifting music. I'll make it a session worth remembering."}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function giftCardRecipientEmail(v: GiftCardView): EmailOutput {
  const es = v.lang === "es";
  const from = firstName(v.purchaserName);
  const subject = es ? `${from} te regaló una sesión en Raw Planet 🎁` : `${from} sent you a Raw Planet gift card 🎁`;
  const preview = es
    ? `${v.amount} para una sesión de producción, DJ o meditación con sonido en Nueva York.`
    : `${v.amount} toward a music production, DJ or sound meditation session in New York.`;
  const element = (
    <Layout lang={v.lang} theme="production" preview={preview}>
      <Eyebrow>{es ? "Un regalo para ti" : "A gift for you"}</Eyebrow>
      <H1>{v.recipientName ? (es ? `${firstName(v.recipientName)}, esto es para ti` : `${firstName(v.recipientName)}, this is for you`) : es ? "Esto es para ti" : "This is for you"}</H1>
      <P>
        {es
          ? `${v.purchaserName} te regaló ${v.amount} para una sesión privada con Alex en su estudio de Nueva York: crear tu propia canción, aprender a mezclar como DJ o bajar el ritmo con un baño de sonido. No necesitas experiencia.`
          : `${v.purchaserName} gave you ${v.amount} toward a private session with Alex at his New York studio: make your own track, learn to mix like a DJ, or slow down with a sound bath. No experience needed.`}
      </P>
      {v.message ? (
        <Panel bg={ACCENTS.production.soft}>
          <Text style={{ margin: 0, fontFamily: FONT_BODY, fontSize: "18px", lineHeight: "28px", fontStyle: "italic", color: C.cocoa }}>“{v.message}”</Text>
          <Text style={{ margin: "8px 0 0", fontFamily: FONT_BODY, fontSize: "14px", color: C.inkSoft }}>— {v.purchaserName}</Text>
        </Panel>
      ) : null}
      <CardTicket v={v} />
      <Actions>
        <Btn href={v.bookUrl}>{es ? "Elegir mi sesión" : "Choose my session"}</Btn>
      </Actions>
      <HowToUse v={v} />
      <NoteFromAlex accent={ACCENTS.production.strong} signoff={signoff(v.lang)}>
        {es
          ? "Alguien piensa que tienes música por dentro. Ven a sacarla. ¡Nos vemos en el estudio!"
          : "Someone thinks there's music in you. Come let it out. See you in the studio!"}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}
