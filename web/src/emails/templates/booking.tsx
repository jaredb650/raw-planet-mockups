/** Guest-facing booking lifecycle emails (EN + ES). */
import { Text } from "@react-email/components";
import { siteUrl } from "@/lib/config";
import { Layout } from "../components/Layout";
import {
  A,
  Actions,
  Btn,
  Bullets,
  Code,
  Details,
  Divider,
  Eyebrow,
  Gap,
  H1,
  H2,
  NoteFromAlex,
  P,
  Panel,
  PriceTable,
} from "../components/ui";
import { alexNote, INSTAGRAM_HANDLE, signoff, t, whatToBring } from "../copy";
import { nyTime, tr, withDot } from "../i18n";
import { accentFor, C, FONT_BODY } from "../theme";
import type { BookingView, EmailOutput } from "../types";

const es = (v: { lang: string }) => v.lang === "es";

function whenValue(v: BookingView) {
  return (
    <>
      {v.dateLabel}
      <br />
      {v.timeLabel}{" "}
      <span style={{ color: C.inkSoft, fontWeight: 400 }}>
        ({nyTime(v.lang)})
      </span>
    </>
  );
}

function whereValue(v: BookingView) {
  if (!v.address)
    return (
      <>
        {v.locationArea}
        <br />
        <span style={{ color: C.inkSoft, fontWeight: 400 }}>
          {t("addressSoon", v.lang)}
        </span>
      </>
    );
  return (
    <>
      {v.address}
      {v.mapUrl ? (
        <>
          <br />
          <A href={v.mapUrl}>{t("map", v.lang)} →</A>
        </>
      ) : null}
    </>
  );
}

function sessionRows(
  v: BookingView,
  opts: { code?: boolean; notes?: boolean } = {},
) {
  return [
    { label: t("experience", v.lang), value: v.experienceName, strong: true },
    { label: t("when", v.lang), value: whenValue(v), strong: true },
    { label: t("duration", v.lang), value: v.durationLabel },
    { label: t("guests", v.lang), value: v.guestsLabel },
    { label: t("where", v.lang), value: whereValue(v) },
    v.arrivalInstructions
      ? {
          label: t("gettingIn", v.lang),
          value: tr(v.arrivalInstructions, v.lang),
        }
      : null,
    v.occasion ? { label: t("occasion", v.lang), value: v.occasion } : null,
    opts.notes && v.notes
      ? {
          label: t("yourNote", v.lang),
          value: <span style={{ whiteSpace: "pre-line" }}>{v.notes}</span>,
        }
      : null,
    opts.code !== false
      ? { label: t("code", v.lang), value: <Code>{v.code}</Code> }
      : null,
  ];
}

function CalendarButtons({
  v,
  manage = true,
}: {
  v: BookingView;
  manage?: boolean;
}) {
  return (
    <>
      <Actions>
        {manage ? (
          <>
            <Btn href={v.manageUrl}>{t("manage", v.lang)}</Btn>
            <Gap />
          </>
        ) : null}
        <Btn href={v.googleCalendarUrl} variant="secondary">
          {t("addGoogle", v.lang)}
        </Btn>
      </Actions>
      <P small muted>
        {t("icsNote", v.lang)}
      </P>
    </>
  );
}

function CancellationPanel({ v }: { v: BookingView }) {
  const accent = accentFor(v.theme);
  return (
    <Panel bg={accent.soft}>
      <P style={{ margin: "0 0 6px", fontWeight: 700 }}>
        {es(v) ? "Cambios y cancelaciones" : "Changes & cancellations"}
      </P>
      {v.cancelOpen ? (
        <P small style={{ margin: 0 }}>
          {es(v) ? (
            <>
              Cancelación gratis hasta el <strong>{v.cancelDeadline}</strong> (
              {nyTime(v.lang)}). Después de esa hora la reserva ya no es
              reembolsable. Puedes cambiar la hora o cancelar tú mismo desde{" "}
              <A href={v.manageUrl}>tu reserva</A>.
            </>
          ) : (
            <>
              Free cancellation until <strong>{v.cancelDeadline}</strong> (
              {nyTime(v.lang)}). After that the booking is non-refundable. You
              can reschedule or cancel yourself from{" "}
              <A href={v.manageUrl}>your booking page</A>.
            </>
          )}
        </P>
      ) : (
        <P small style={{ margin: 0 }}>
          {es(v)
            ? `Tu sesión es en menos de ${v.cancellationHours} horas, así que ya pasó el plazo de cancelación gratis. Si te surge algo, responde a este correo y vemos qué podemos hacer.`
            : `Your session is less than ${v.cancellationHours} hours away, so it's past the free-cancellation window. If something comes up, reply to this email and we'll see what we can do.`}
        </P>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

export function bookingConfirmationEmail(v: BookingView): EmailOutput {
  const accent = accentFor(v.theme);
  const subject = es(v)
    ? `¡Reserva confirmada! ${v.experienceName}, ${v.dateShort}`
    : `You're booked: ${v.experienceName}, ${v.dateShort} at ${v.timeLabel.split(" – ")[0]}`;
  const preview = es(v)
    ? `Todo lo que necesitas para el ${v.dateLabel}: dirección, qué incluye y tu invitación de calendario.`
    : `Everything you need for ${v.dateLabel}: address, what's included and your calendar invite.`;
  const recipient = v.giftRecipientName ?? "";
  const element = (
    <Layout
      lang={v.lang}
      theme={v.theme}
      preview={preview}
      manageUrl={v.manageUrl}
    >
      <Eyebrow>
        {es(v) ? "Reserva confirmada" : "Booking confirmed"} · {v.code}
      </Eyebrow>
      <H1>
        {v.isGift
          ? es(v)
            ? "¡Regalo reservado!"
            : "Gift booked!"
          : es(v)
            ? `¡Listo, ${v.guestFirstName}!`
            : `You're booked, ${v.guestFirstName}!`}
      </H1>
      {v.isGift ? (
        <P>
          {es(v) ? (
            <>
              La {v.experienceName.toLowerCase()} para{" "}
              <strong>{recipient}</strong> ya está reservada.{" "}
              {v.giftRecipientEmail
                ? `También le enviamos un correo a ${recipient} con los detalles${v.giftMessage ? " y tu mensaje" : ""}.`
                : `Reenvíale este correo a ${recipient} para que sepa a dónde ir.`}
            </>
          ) : (
            <>
              Your {v.experienceName} gift for <strong>{recipient}</strong> is
              booked.{" "}
              {v.giftRecipientEmail
                ? `We've also emailed ${recipient} the details${v.giftMessage ? " along with your message" : ""}.`
                : `Forward this email to ${recipient} so they know where to go.`}
            </>
          )}
        </P>
      ) : (
        <P>
          {es(v)
            ? `Tu ${v.experienceName.toLowerCase()} con Alex está confirmada. Aquí tienes todo lo que necesitas; guarda este correo porque tiene ${v.address ? "la dirección" : "los detalles"} y la invitación de calendario.`
            : `Your ${v.experienceName} with Alex is locked in. Here's everything you need. Keep this email handy: it has ${v.address ? "the address" : "your booking details"} and your calendar invite.`}
        </P>
      )}

      <Details rows={sessionRows(v, { notes: true })} accent={accent.strong} />
      <CalendarButtons v={v} />

      {v.includes.length ? (
        <>
          <H2>{es(v) ? "Qué incluye" : "What's included"}</H2>
          <Bullets items={v.includes.map((i) => tr(i, v.lang))} />
        </>
      ) : null}

      {v.priceLines.length ? (
        <>
          <H2>{es(v) ? "Tu pago" : "Payment"}</H2>
          <PriceTable
            lines={v.priceLines}
            totalLabel={t(v.paid ? "totalPaid" : "totalDue", v.lang)}
            total={v.totalPaid}
          />
        </>
      ) : null}

      <CancellationPanel v={v} />

      {v.goodToKnow.length ? (
        <>
          <H2>{es(v) ? "Bueno saber" : "Good to know"}</H2>
          <Bullets items={v.goodToKnow.map((i) => tr(i, v.lang))} />
        </>
      ) : null}

      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {alexNote(v.theme, v.lang)}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

/** Sent to the person a booking was gifted to (no manage link: the purchaser owns the booking). */
export function giftBookingRecipientEmail(
  v: BookingView & { purchaserName: string },
): EmailOutput {
  const accent = accentFor(v.theme);
  const from = v.purchaserName.split(/\s+/)[0];
  const subject = es(v)
    ? `${from} te regaló una ${v.experienceName.toLowerCase()} 🎁`
    : `${from} booked you a ${v.experienceName} 🎁`;
  const preview = es(v)
    ? `${v.dateLabel}, ${withDot(v.timeLabel)} Aquí tienes los detalles.`
    : `${v.dateLabel}, ${v.timeLabel}. Here are the details.`;
  const element = (
    <Layout lang={v.lang} theme={v.theme} preview={preview}>
      <Eyebrow>{es(v) ? "Un regalo para ti" : "A gift for you"}</Eyebrow>
      <H1>
        {es(v)
          ? `${v.giftRecipientName ? v.giftRecipientName.split(/\s+/)[0] + ", t" : "T"}ienes una sesión reservada`
          : `${v.giftRecipientName ? v.giftRecipientName.split(/\s+/)[0] + ", y" : "Y"}ou've got a session booked`}
      </H1>
      <P>
        {es(v)
          ? `${v.purchaserName} te reservó una ${v.experienceName.toLowerCase()} privada con Alex en Nueva York. No necesitas experiencia: solo ven con ganas.`
          : `${v.purchaserName} booked you a private ${v.experienceName} with Alex in New York. No experience needed, just show up curious.`}
      </P>
      {v.giftMessage ? (
        <Panel bg={accent.soft}>
          <Text
            style={{
              margin: 0,
              fontFamily: FONT_BODY,
              fontSize: "18px",
              lineHeight: "28px",
              fontStyle: "italic",
              color: C.cocoa,
            }}
          >
            “{v.giftMessage}”
          </Text>
          <Text
            style={{
              margin: "8px 0 0",
              fontFamily: FONT_BODY,
              fontSize: "14px",
              color: C.inkSoft,
            }}
          >
            — {v.purchaserName}
          </Text>
        </Panel>
      ) : null}
      <Details rows={sessionRows(v, { code: true })} accent={accent.strong} />
      <CalendarButtons v={v} manage={false} />
      {v.includes.length ? (
        <>
          <H2>{es(v) ? "Qué incluye" : "What's included"}</H2>
          <Bullets items={v.includes.map((i) => tr(i, v.lang))} />
        </>
      ) : null}
      <P muted small>
        {es(v)
          ? `¿Necesitas otra fecha o tienes preguntas? Responde a este correo, o pídele a ${from} que la cambie desde su enlace de reserva.`
          : `Need a different time or have a question? Reply to this email, or ask ${from} to change it from their booking link.`}
      </P>
      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {alexNote(v.theme, v.lang)}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function bookingRescheduledEmail(
  v: BookingView & { previousLabel: string },
): EmailOutput {
  const accent = accentFor(v.theme);
  const subject = es(v)
    ? `Nueva hora: ${v.experienceName}, ${v.dateShort}`
    : `New time: ${v.experienceName}, ${v.dateShort}`;
  const preview = es(v)
    ? `Ahora es el ${v.dateLabel}, ${withDot(v.timeLabel)} Invitación actualizada adjunta.`
    : `Now ${v.dateLabel}, ${v.timeLabel}. Updated invite attached.`;
  const element = (
    <Layout
      lang={v.lang}
      theme={v.theme}
      preview={preview}
      manageUrl={v.manageUrl}
    >
      <Eyebrow>
        {es(v) ? "Cambio confirmado" : "Change confirmed"} · {v.code}
      </Eyebrow>
      <H1>
        {es(v)
          ? `Nos vemos el ${v.dateShort}`
          : `You're moved to ${v.dateShort}`}
      </H1>
      <P>
        {es(v)
          ? "Listo, tu sesión tiene nueva hora. El horario anterior ya quedó libre."
          : "Done. Your session has a new time and the old slot has been released."}
      </P>
      <Panel>
        <P
          small
          muted
          style={{ margin: "0 0 4px", textDecoration: "line-through" }}
        >
          {v.previousLabel}
        </P>
        <P style={{ margin: 0, fontWeight: 700 }}>
          → {v.dateLabel}, {v.timeLabel} ({nyTime(v.lang)})
        </P>
      </Panel>
      <Details rows={sessionRows(v)} accent={accent.strong} />
      <CalendarButtons v={v} />
      <P small muted>
        {es(v)
          ? "Si ya habías guardado la sesión en tu calendario, abre la invitación adjunta y se actualiza sola."
          : "Already saved the old time? Open the attached invite and your calendar will update the existing event."}
      </P>
      <CancellationPanel v={v} />
    </Layout>
  );
  return { subject, element };
}

export function bookingCancelledEmail(
  v: BookingView & {
    cardRefund: string | null;
    giftRefund: string | null;
    paidSomething: boolean;
  },
): EmailOutput {
  const accent = accentFor(v.theme);
  const subject = es(v)
    ? `Reserva cancelada: ${v.experienceName}, ${v.dateShort}`
    : `Cancelled: ${v.experienceName}, ${v.dateShort}`;
  const preview = v.cardRefund
    ? es(v)
      ? `Te devolvimos ${v.cardRefund} a tu tarjeta.`
      : `${v.cardRefund} is on its way back to your card.`
    : es(v)
      ? "Tu reserva quedó cancelada."
      : "Your booking has been cancelled.";
  const element = (
    <Layout lang={v.lang} theme={v.theme} preview={preview}>
      <Eyebrow color={C.inkSoft}>
        {es(v) ? "Reserva cancelada" : "Booking cancelled"} · {v.code}
      </Eyebrow>
      <H1>
        {es(v) ? "Tu reserva está cancelada" : "Your booking is cancelled"}
      </H1>
      <P>
        {es(v)
          ? `Cancelamos tu ${v.experienceName.toLowerCase()} del ${v.dateLabel}, ${withDot(v.timeLabel)}`
          : `We've cancelled your ${v.experienceName} on ${v.dateLabel}, ${v.timeLabel}.`}
      </P>
      {/* Gift recipients (no manage link) didn't pay, so they get no refund panel. */}
      {v.manageUrl ? (
        <Panel bg={accent.soft}>
          <P style={{ margin: "0 0 6px", fontWeight: 700 }}>
            {es(v) ? "Tu reembolso" : "Your refund"}
          </P>
          {v.cardRefund ? (
            <P small style={{ margin: "0 0 6px" }}>
              {es(v) ? (
                <>
                  <strong>{v.cardRefund}</strong> de vuelta a tu tarjeta. Los
                  bancos suelen tardar entre 5 y 10 días hábiles en mostrarlo.
                </>
              ) : (
                <>
                  <strong>{v.cardRefund}</strong> back to your card. Banks
                  usually take 5–10 business days to show it.
                </>
              )}
            </P>
          ) : null}
          {v.giftRefund ? (
            <P small style={{ margin: "0 0 6px" }}>
              {es(v) ? (
                <>
                  <strong>{v.giftRefund}</strong> de vuelta en tu tarjeta de
                  regalo, lista para usar otra vez.
                </>
              ) : (
                <>
                  <strong>{v.giftRefund}</strong> back on your gift card, ready
                  to use again.
                </>
              )}
            </P>
          ) : null}
          {!v.cardRefund && !v.giftRefund ? (
            <P small style={{ margin: 0 }}>
              {v.paidSomething
                ? es(v)
                  ? "Esta cancelación fue fuera del plazo de cancelación gratis, así que no hubo reembolso. Si crees que es un error, responde a este correo."
                  : "This cancellation was outside the free-cancellation window, so no refund was issued. If you think that's a mistake, just reply to this email."
                : es(v)
                  ? "No se hizo ningún cobro por esta reserva, así que no hay nada que devolver."
                  : "Nothing was charged for this booking, so there's nothing to refund."}
            </P>
          ) : null}
        </Panel>
      ) : null}
      <P small muted>
        {t("icsCancelNote", v.lang)}
      </P>
      <Actions>
        <Btn href={v.bookUrl}>
          {es(v) ? "Reservar otra fecha" : "Book another time"}
        </Btn>
      </Actions>
      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {es(v)
          ? "Qué lástima que no nos veamos esta vez. Cuando quieras volver, aquí estaré."
          : "Sorry we won't see you this time. Whenever you're ready, the studio door's open."}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function bookingReminderEmail(
  v: BookingView & { dayWord: string },
): EmailOutput {
  const accent = accentFor(v.theme);
  const start = v.timeLabel.split(" – ")[0];
  const subject = es(v)
    ? `${v.dayWord === "hoy" ? "Hoy" : "Mañana"}: ${v.experienceName} a las ${start}`
    : `${v.dayWord === "today" ? "Today" : "Tomorrow"}: ${v.experienceName} at ${start}`;
  const preview = es(v)
    ? "Dirección, cómo entrar y qué traer."
    : "Address, how to get in, and what to bring.";
  const bring = whatToBring(v.theme, v.lang);
  const element = (
    <Layout
      lang={v.lang}
      theme={v.theme}
      preview={preview}
      manageUrl={v.manageUrl}
    >
      <Eyebrow>
        {es(v) ? "Recordatorio" : "Reminder"} · {v.code}
      </Eyebrow>
      <H1>
        {es(v)
          ? `¡Nos vemos ${v.dayWord}, ${v.guestFirstName}!`
          : `See you ${v.dayWord}, ${v.guestFirstName}!`}
      </H1>
      <P>
        {es(v)
          ? `Tu ${v.experienceName.toLowerCase()} empieza ${v.dayWord} a las ${withDot(start)} Aquí va lo esencial para llegar sin estrés.`
          : `Your ${v.experienceName} starts ${v.dayWord} at ${start}. Here's the essentials so getting there is easy.`}
      </P>
      <Details
        accent={accent.strong}
        rows={[
          { label: t("when", v.lang), value: whenValue(v), strong: true },
          { label: t("where", v.lang), value: whereValue(v), strong: true },
          v.arrivalInstructions
            ? {
                label: t("gettingIn", v.lang),
                value: tr(v.arrivalInstructions, v.lang),
              }
            : null,
          { label: t("guests", v.lang), value: v.guestsLabel },
          v.hostPhone || v.hostWhatsapp
            ? {
                label: es(v) ? "Contacto de Alex" : "Reach Alex",
                value: (
                  <>
                    {v.hostPhone ? (
                      <>
                        <A href={`tel:${v.hostPhone.replace(/[^\d+]/g, "")}`}>
                          {v.hostPhone}
                        </A>
                        {v.hostWhatsapp ? <br /> : null}
                      </>
                    ) : null}
                    {v.hostWhatsapp ? (
                      <A
                        href={`https://wa.me/${v.hostWhatsapp.replace(/[^\d]/g, "")}`}
                      >
                        WhatsApp
                      </A>
                    ) : null}
                  </>
                ),
              }
            : null,
        ]}
      />
      {bring.length ? (
        <>
          <H2>{es(v) ? "Qué traer" : "What to bring"}</H2>
          <Bullets items={bring} />
        </>
      ) : null}
      <P small muted>
        {es(v)
          ? "¿Vas tarde o te perdiste? Responde a este correo y Alex te ayuda. La sesión termina a la hora reservada, así que llegar a tiempo te da más tiempo de música."
          : "Running late or can't find it? Reply to this email and Alex will help. Sessions end on time, so arriving on time means more time making music."}
      </P>
      <Actions>
        {v.manageUrl ? (
          <Btn href={v.manageUrl}>{t("manage", v.lang)}</Btn>
        ) : null}
        {v.mapUrl ? (
          <>
            {v.manageUrl ? <Gap /> : null}
            <Btn href={v.mapUrl} variant="secondary">
              {t("map", v.lang)}
            </Btn>
          </>
        ) : null}
      </Actions>
      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {es(v)
          ? "¡Ya tengo todo listo para ti! Nos vemos pronto."
          : "Everything's set up and ready for you. See you soon!"}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function followupEmail(v: BookingView): EmailOutput {
  const accent = accentFor(v.theme);
  const production = v.theme === "production";
  const subject = es(v)
    ? `Gracias por venir, ${v.guestFirstName}`
    : production
      ? `Thanks for making music with us, ${v.guestFirstName}`
      : `Thanks for coming in, ${v.guestFirstName}`;
  const preview = es(v)
    ? "¿Nos dejas una reseña? Toma un minuto."
    : "Got a minute for a quick review?";
  const element = (
    <Layout
      lang={v.lang}
      theme={v.theme}
      preview={preview}
      manageUrl={v.manageUrl}
    >
      <Eyebrow>{es(v) ? "Gracias" : "Thank you"}</Eyebrow>
      <H1>{es(v) ? "¡Qué buena sesión!" : "That was a good one."}</H1>
      <P>
        {es(v)
          ? `Gracias por pasar tu tiempo en el estudio, ${v.guestFirstName}. Ojalá te hayas ido con algo de música en la cabeza (y una sonrisa).`
          : `Thanks for spending your time in the studio, ${v.guestFirstName}. Hope you left with music stuck in your head and a big grin.`}
      </P>
      {production && !v.deliverableReady ? (
        <Panel bg={accent.soft}>
          <P style={{ margin: "0 0 4px", fontWeight: 700 }}>
            {es(v)
              ? "Tu canción va en camino 🎧"
              : "Your track is on its way 🎧"}
          </P>
          <P small style={{ margin: 0 }}>
            {es(v)
              ? "Alex le está dando la mezcla final. Te llega un correo con el enlace de descarga en cuanto esté lista."
              : "Alex is giving it a final mix. You'll get an email with a download link as soon as it's ready."}
          </P>
        </Panel>
      ) : null}
      <H2>{es(v) ? "¿Cómo te fue?" : "How did we do?"}</H2>
      <P>
        {es(v)
          ? "Raw Planet es un estudio de una sola persona, y las reseñas son como nos encuentra gente nueva. Si la pasaste bien, unas palabras ayudan muchísimo."
          : "Raw Planet is a one-person studio, and reviews are how new people find us. If you had a good time, a few words go a long way."}
      </P>
      <Actions>
        <Btn href={v.reviewUrl}>
          {es(v) ? "Dejar una reseña" : "Leave a review"}
        </Btn>
      </Actions>
      <P small muted>
        {es(v)
          ? `¿Vas a publicar algo? Etiqueta a ${INSTAGRAM_HANDLE} en Instagram y lo compartimos.`
          : `Posting about it? Tag ${INSTAGRAM_HANDLE} on Instagram and we'll share it.`}
      </P>
      <Divider />
      <P>
        {es(v) ? (
          <>
            ¿Conoces a alguien a quien le encantaría?{" "}
            <A href={siteUrl("/gift-cards")}>Regala una tarjeta de regalo</A>.
            ¿Y tú, segunda ronda? <A href={v.bookUrl}>Reserva otra sesión</A>.
          </>
        ) : (
          <>
            Know someone who’d love this?{" "}
            <A href={siteUrl("/gift-cards")}>Send them a gift card</A>. Ready
            for round two? <A href={v.bookUrl}>Book another session</A>.
          </>
        )}
      </P>
      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {es(v)
          ? "Fue un gusto crear contigo. ¡Vuelve cuando quieras!"
          : "Loved making music with you. Come back anytime."}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function reviewNudgeEmail(v: BookingView): EmailOutput {
  const accent = accentFor(v.theme);
  const subject = es(v) ? "¿Tienes 60 segundos?" : "Got 60 seconds?";
  const preview = es(v)
    ? "Una reseña corta ayuda muchísimo a un estudio pequeño."
    : "A short review helps a small studio more than you'd think.";
  const element = (
    <Layout lang={v.lang} theme={v.theme} preview={preview}>
      <H1>{es(v) ? `Hola, ${v.guestFirstName}` : `Hey ${v.guestFirstName}`}</H1>
      <P>
        {es(v)
          ? `Si disfrutaste tu ${v.experienceName.toLowerCase()} del ${v.dateShort}, ¿nos dejarías una reseña rápida? Es lo que más ayuda a que otras personas encuentren el estudio.`
          : `If you enjoyed your ${v.experienceName} on ${v.dateShort}, would you leave a quick review? It's the single biggest thing that helps other people find the studio.`}
      </P>
      <Actions>
        <Btn href={v.reviewUrl}>
          {es(v) ? "Escribir reseña" : "Write a review"}
        </Btn>
      </Actions>
      <P small muted>
        {es(v)
          ? "Es la última vez que te lo pedimos, lo prometo."
          : "This is the last time we'll ask. Promise."}
      </P>
      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {es(v) ? "¡Gracias de corazón!" : "Thank you, truly."}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function deliverableReadyEmail(
  v: BookingView & { hasReview: boolean },
): EmailOutput {
  const accent = accentFor(v.theme);
  const thing =
    v.theme === "dj" ? (es(v) ? "mezcla" : "mix") : es(v) ? "canción" : "track";
  const subject = es(v)
    ? `Tu ${thing} está lista 🎧`
    : `Your ${thing} is ready 🎧`;
  const preview = es(v)
    ? "Descárgala, ponla a todo volumen y compártela."
    : "Download it, play it loud, share it.";
  const element = (
    <Layout
      lang={v.lang}
      theme={v.theme}
      preview={preview}
      manageUrl={v.manageUrl}
    >
      <Eyebrow>
        {es(v) ? `Tu ${thing}` : `Your ${thing}`} · {v.code}
      </Eyebrow>
      <H1>{es(v) ? `¡Tu ${thing} está lista!` : `Your ${thing} is ready!`}</H1>
      <P>
        {es(v)
          ? `Alex terminó la mezcla de lo que hicieron juntos el ${v.dateShort}. Descárgala, guárdala en algún lugar seguro y ponla a todo volumen.`
          : `Alex has finished mixing what you made together on ${v.dateShort}. Download it, save it somewhere safe, and play it loud.`}
      </P>
      {v.deliverableUrl ? (
        <Actions>
          <Btn href={v.deliverableUrl}>
            {es(v) ? `Descargar tu ${thing}` : `Download your ${thing}`}
          </Btn>
        </Actions>
      ) : null}
      <Panel bg={accent.soft}>
        <P style={{ margin: "0 0 4px", fontWeight: 700 }}>
          {es(v) ? "Compártela 📣" : "Share it 📣"}
        </P>
        <P small style={{ margin: 0 }}>
          {es(v)
            ? `Súbela a tus historias y etiqueta a ${INSTAGRAM_HANDLE}. Nos encanta escuchar lo que se crea aquí sonando por ahí.`
            : `Put it on your story and tag ${INSTAGRAM_HANDLE}. We love hearing music made here out in the world.`}
        </P>
      </Panel>
      {!v.hasReview ? (
        <P>
          {es(v) ? (
            <>
              ¿Y si nos dejas una <A href={v.reviewUrl}>reseña rápida</A>? Ayuda
              muchísimo a un estudio pequeño.
            </>
          ) : (
            <>
              And if you have a minute, a <A href={v.reviewUrl}>quick review</A>{" "}
              helps a small studio a lot.
            </>
          )}
        </P>
      ) : null}
      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {es(v)
          ? "Me encantó cómo quedó. ¡Disfrútala!"
          : "Really happy with how this one came out. Enjoy it!"}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function slotConflictRefundEmail(
  v: BookingView & { refund: string; giftShort?: boolean },
): EmailOutput {
  const accent = accentFor(v.theme);
  const pickUrl = `${v.bookUrl}?date=${v.dateKey}`;
  const subject = v.giftShort
    ? es(v)
      ? "No pudimos confirmar tu reserva y te reembolsamos todo"
      : "We couldn't confirm your booking, and you've been fully refunded"
    : es(v)
      ? "Lo sentimos: ese horario se ocupó y te reembolsamos todo"
      : "Sorry! That time was just taken, and you've been fully refunded";
  const preview = es(v)
    ? `Te devolvimos ${v.refund}. Elige otro horario cuando quieras.`
    : `We've refunded ${v.refund}. Pick another time whenever you're ready.`;
  const element = (
    <Layout lang={v.lang} theme={v.theme} preview={preview}>
      <Eyebrow color={C.inkSoft}>{v.code}</Eyebrow>
      <H1>{es(v) ? "Lo sentimos mucho" : "We're so sorry"}</H1>
      <P>
        {v.giftShort
          ? es(v)
            ? `Mientras completabas el pago, el saldo de tu tarjeta de regalo se usó en otra reserva, así que ya no cubría su parte del ${v.dateLabel}, ${withDot(v.timeLabel)} No pudimos confirmar tu reserva.`
            : `While you were checking out, your gift card's balance was used on another booking, so it no longer covered its share of ${v.dateLabel}, ${v.timeLabel}. We couldn't confirm your booking.`
          : es(v)
            ? `Mientras completabas el pago, alguien más reservó el ${v.dateLabel}, ${withDot(v.timeLabel)} Como Alex solo puede estar en un lugar a la vez, no pudimos confirmar tu reserva.`
            : `While you were checking out, someone else booked ${v.dateLabel}, ${v.timeLabel}. Alex can only be in one place at a time, so we couldn't confirm your booking.`}
      </P>
      <Panel bg={accent.soft}>
        <P style={{ margin: "0 0 4px", fontWeight: 700 }}>
          {es(v)
            ? `Reembolso completo: ${v.refund}`
            : `Full refund: ${v.refund}`}
        </P>
        <P small style={{ margin: 0 }}>
          {es(v)
            ? "Ya va de vuelta a tu tarjeta. Los bancos suelen tardar entre 5 y 10 días hábiles en mostrarlo. Si usaste una tarjeta de regalo, su saldo no se tocó."
            : "It's already on its way back to your card. Banks usually take 5–10 business days to show it. If you used a gift card, its balance wasn't touched."}
        </P>
      </Panel>
      <P>
        {es(v)
          ? "Nos encantaría recibirte en otro horario:"
          : "We'd still love to have you. Pick another time:"}
      </P>
      <Actions>
        <Btn href={pickUrl}>
          {es(v) ? "Elegir otro horario" : "Pick another time"}
        </Btn>
      </Actions>
      <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
        {es(v)
          ? "Perdón por el enredo. Si ninguna hora te funciona, respóndeme y buscamos una juntos."
          : "Sorry for the mix-up. If none of the open times work, reply to me and we'll find one together."}
      </NoteFromAlex>
    </Layout>
  );
  return { subject, element };
}

export function abandonedCheckoutEmail(v: BookingView): EmailOutput {
  const accent = accentFor(v.theme);
  const url = `${v.bookUrl}?date=${v.dateKey}`;
  const subject = es(v)
    ? `¿Sigues pensando en tu ${v.experienceName.toLowerCase()}?`
    : `Still want that ${v.experienceName}?`;
  const preview = es(v)
    ? "Liberamos el horario, pero puede que siga disponible."
    : "We released the hold, but that time may still be open.";
  const element = (
    <Layout lang={v.lang} theme={v.theme} preview={preview}>
      <H1>{es(v) ? "¿Todavía te animas?" : "Still in?"}</H1>
      <P>
        {es(v)
          ? `Empezaste a reservar una ${v.experienceName.toLowerCase()} para el ${v.dateLabel}, ${v.timeLabel}, pero el pago no se completó, así que liberamos el horario. Si sigue libre, es tuyo.`
          : `You started booking a ${v.experienceName} for ${v.dateLabel}, ${v.timeLabel}, but checkout didn't finish, so we released the hold. If that time's still open, it's yours.`}
      </P>
      <Details
        accent={accent.strong}
        rows={[
          {
            label: t("experience", v.lang),
            value: v.experienceName,
            strong: true,
          },
          { label: t("when", v.lang), value: whenValue(v) },
          { label: t("guests", v.lang), value: v.guestsLabel },
        ]}
      />
      <Actions>
        <Btn href={url}>{es(v) ? "Terminar mi reserva" : "Finish booking"}</Btn>
      </Actions>
      <P small muted>
        {es(v)
          ? "¿Alguna duda antes de reservar? Responde a este correo; Alex contesta personalmente. Solo te escribimos esta vez."
          : "Questions before you book? Reply to this email. Alex answers personally. We'll only send this once."}
      </P>
    </Layout>
  );
  return { subject, element };
}
