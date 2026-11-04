/** Waitlist opening, community event RSVP and "your booking links" emails (EN + ES). */
import { Layout } from "../components/Layout";
import { A, Actions, Btn, Code, Details, Eyebrow, Gap, H1, H2, NoteFromAlex, P, Panel } from "../components/ui";
import { signoff } from "../copy";
import { firstName, nyTime, type Lang } from "../i18n";
import { accentFor, ACCENTS, C } from "../theme";
import type { EmailOutput } from "../types";

/* ------------------------------------------------------------------ */

export type WaitlistView = {
  lang: Lang;
  name: string;
  theme: string;
  experienceName: string;
  /** "Saturday, November 14" */
  dateLabel: string;
  guestsLabel: string;
  /** Booking page deep-linked to the date. */
  bookUrl: string;
};

export function waitlistOpeningEmail(v: WaitlistView): EmailOutput {
  const es = v.lang === "es";
  const accent = accentFor(v.theme);
  const subject = es ? `Se abrió un lugar: ${v.experienceName}, ${v.dateLabel}` : `A spot just opened: ${v.experienceName}, ${v.dateLabel}`;
  const preview = es ? "Te avisamos primero. Los lugares se van rápido." : "You're hearing first. Spots go fast.";
  const element = (
    <Layout lang={v.lang} theme={v.theme} preview={preview}>
      <Eyebrow>{es ? "Lista de espera" : "Waitlist"}</Eyebrow>
      <H1>{es ? "¡Se abrió un lugar!" : "A spot opened up!"}</H1>
      <P>
        {es
          ? `Hola, ${firstName(v.name)}. Se liberó un horario para ${v.experienceName.toLowerCase()} el ${v.dateLabel}, el día que pediste. Le avisamos a todas las personas en la lista a la vez, así que el primero en reservar se lo queda.`
          : `Hi ${firstName(v.name)}, a time just freed up for ${v.experienceName} on ${v.dateLabel}, the day you asked about. Everyone on the waitlist hears at the same moment, so it goes to whoever books first.`}
      </P>
      <Details
        accent={accent.strong}
        rows={[
          { label: es ? "Experiencia" : "Experience", value: v.experienceName, strong: true },
          { label: es ? "Fecha" : "Date", value: v.dateLabel, strong: true },
          { label: es ? "Personas" : "Guests", value: v.guestsLabel },
        ]}
      />
      <Actions>
        <Btn href={v.bookUrl}>{es ? "Ver horarios libres" : "See open times"}</Btn>
      </Actions>
      <P small muted>
        {es
          ? "Si ya no te interesa, ignora este correo. No te escribiremos más por esta fecha."
          : "No longer interested? Just ignore this. We won't email you about this date again."}
      </P>
    </Layout>
  );
  return { subject, element };
}

/* ------------------------------------------------------------------ */

export type RsvpView = {
  lang: Lang;
  name: string;
  title: string;
  summary: string;
  /** "Saturday, November 14, 2026" */
  dateLabel: string;
  timeLabel: string;
  venue: string;
  address: string;
  mapUrl: string | null;
  guests: number;
  guestsLabel: string;
  eventUrl: string;
  meetupUrl: string | null;
  googleCalendarUrl: string;
  cancelled: boolean;
};

export function eventRsvpEmail(v: RsvpView): EmailOutput {
  const es = v.lang === "es";
  const accent = ACCENTS.wellness;
  const subject = v.cancelled
    ? es
      ? `RSVP cancelado: ${v.title}`
      : `RSVP cancelled: ${v.title}`
    : es
      ? `¡Estás en la lista! ${v.title}, ${v.dateLabel}`
      : `You're on the list: ${v.title}, ${v.dateLabel}`;
  const preview = v.cancelled
    ? es
      ? "Quitamos tu nombre de la lista."
      : "We've taken you off the list."
    : es
      ? `${v.timeLabel} · ${v.venue || "Nueva York"}. Invitación de calendario adjunta.`
      : `${v.timeLabel} · ${v.venue || "New York"}. Calendar invite attached.`;
  const element = (
    <Layout lang={v.lang} theme="wellness" preview={preview}>
      <Eyebrow>{es ? "Comunidad" : "Community"}</Eyebrow>
      <H1>{v.cancelled ? (es ? "RSVP cancelado" : "RSVP cancelled") : es ? `¡Nos vemos ahí, ${firstName(v.name)}!` : `See you there, ${firstName(v.name)}!`}</H1>
      <P>
        {v.cancelled
          ? es
            ? `Quitamos tu RSVP para ${v.title}. Si cambias de idea, vuelve a apuntarte desde la página del evento.`
            : `We've removed your RSVP for ${v.title}. Change your mind? You can sign up again from the event page.`
          : es
            ? `Tu lugar en ${v.title} está guardado. Es un encuentro abierto y relajado: ven como eres, trae a alguien si quieres.`
            : `Your spot at ${v.title} is saved. It's a relaxed, open meetup: come as you are and bring a friend if you like.`}
      </P>
      {!v.cancelled ? (
        <>
          <Details
            accent={accent.strong}
            rows={[
              { label: es ? "Evento" : "Event", value: v.title, strong: true },
              {
                label: es ? "Cuándo" : "When",
                value: (
                  <>
                    {v.dateLabel}
                    <br />
                    {v.timeLabel} <span style={{ color: C.inkSoft, fontWeight: 400 }}>({nyTime(v.lang)})</span>
                  </>
                ),
                strong: true,
              },
              v.venue || v.address
                ? {
                    label: es ? "Dónde" : "Where",
                    value: (
                      <>
                        {[v.venue, v.address].filter(Boolean).join(", ")}
                        {v.mapUrl ? (
                          <>
                            <br />
                            <A href={v.mapUrl}>{es ? "Abrir en Maps" : "Open in Maps"} →</A>
                          </>
                        ) : null}
                      </>
                    ),
                  }
                : null,
              { label: es ? "Personas" : "Guests", value: v.guestsLabel },
            ]}
          />
          <Actions>
            <Btn href={v.googleCalendarUrl}>{es ? "Añadir a Google Calendar" : "Add to Google Calendar"}</Btn>
            <Gap />
            <Btn href={v.eventUrl} variant="secondary">
              {es ? "Ver el evento" : "Event details"}
            </Btn>
          </Actions>
          <P small muted>
            {es
              ? "Adjuntamos una invitación de calendario (.ics) para Apple Calendar y Outlook. ¿Ya no puedes ir? Responde a este correo para liberar tu lugar."
              : "A calendar invite (.ics) is attached for Apple Calendar and Outlook. Can't make it? Reply to this email so someone else can have your spot."}
          </P>
          {v.meetupUrl ? (
            <Panel bg={accent.soft}>
              <P small style={{ margin: 0 }}>
                {es ? (
                  <>Este encuentro también está en Meetup. <A href={v.meetupUrl}>Únete al grupo</A> para enterarte de las próximas fechas (cada dos semanas).</>
                ) : (
                  <>This meetup is on Meetup too. <A href={v.meetupUrl}>Join the group</A> to hear about the next ones (every two weeks).</>
                )}
              </P>
            </Panel>
          ) : null}
          <NoteFromAlex accent={accent.strong} signoff={signoff(v.lang)}>
            {es ? "Estos encuentros son mi parte favorita del mes. ¡Qué bueno que vienes!" : "These meetups are my favorite part of the month. Glad you're coming."}
          </NoteFromAlex>
        </>
      ) : null}
    </Layout>
  );
  return { subject, element };
}

/* ------------------------------------------------------------------ */

export type ManageLinkItem = { code: string; experienceName: string; dateLabel: string; timeLabel: string; manageUrl: string; theme: string };

export type ManageLinksView = {
  lang: Lang;
  name: string;
  upcoming: ManageLinkItem[];
  past: ManageLinkItem[];
  bookUrl: string;
};

export function manageLinksEmail(v: ManageLinksView): EmailOutput {
  const es = v.lang === "es";
  const n = v.upcoming.length;
  const subject = es ? (n ? "Tus enlaces de reserva de Raw Planet" : "Tus reservas en Raw Planet") : n ? "Your Raw Planet booking links" : "Your Raw Planet bookings";
  const preview = es
    ? n
      ? `${n} ${n === 1 ? "reserva próxima" : "reservas próximas"}: cambia la hora, cancela o descarga la invitación.`
      : "No tienes reservas próximas con este correo."
    : n
      ? `${n} upcoming ${n === 1 ? "booking" : "bookings"}: reschedule, cancel or grab the calendar invite.`
      : "No upcoming bookings under this email.";
  const Item = ({ b }: { b: ManageLinkItem }) => (
    <Panel bg={accentFor(b.theme).soft}>
      <P style={{ margin: "0 0 2px", fontWeight: 700 }}>{b.experienceName}</P>
      <P small style={{ margin: "0 0 8px" }}>
        {b.dateLabel}, {b.timeLabel} · <Code>{b.code}</Code>
      </P>
      <A href={b.manageUrl}>{es ? "Gestionar esta reserva" : "Manage this booking"} →</A>
    </Panel>
  );
  const element = (
    <Layout lang={v.lang} preview={preview}>
      <Eyebrow>{es ? "Tus reservas" : "Your bookings"}</Eyebrow>
      <H1>{es ? `Aquí tienes, ${firstName(v.name)}` : `Here you go, ${firstName(v.name)}`}</H1>
      <P>
        {n
          ? es
            ? "Alguien (seguramente tú) pidió los enlaces de las reservas hechas con este correo. Desde cada enlace puedes cambiar la hora, cancelar o ver los detalles."
            : "Someone (probably you) asked for the links to bookings made with this email. Each link lets you reschedule, cancel or see the details."
          : es
            ? "Alguien (seguramente tú) pidió los enlaces de reserva de este correo, pero no hay sesiones próximas."
            : "Someone (probably you) asked for the booking links for this email, but there are no upcoming sessions."}
      </P>
      {v.upcoming.map((b) => (
        <Item key={b.code} b={b} />
      ))}
      {v.past.length ? (
        <>
          <H2>{es ? "Sesiones anteriores" : "Past sessions"}</H2>
          {v.past.map((b) => (
            <Item key={b.code} b={b} />
          ))}
        </>
      ) : null}
      {!n ? (
        <Actions>
          <Btn href={v.bookUrl}>{es ? "Reservar una sesión" : "Book a session"}</Btn>
        </Actions>
      ) : null}
      <P small muted>
        {es
          ? "¿No fuiste tú? No pasa nada: los enlaces solo llegan a este correo. Puedes ignorar este mensaje."
          : "Didn't ask for this? No problem: links only ever go to this inbox, so you can ignore it."}
      </P>
    </Layout>
  );
  return { subject, element };
}
