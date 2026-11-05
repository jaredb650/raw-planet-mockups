/**
 * Participation and recording release: the wording (EN + ES) and the rules for
 * who can still sign. Pure, so the signing form, the API and tests share it.
 *
 * shortcut: plain-language draft, not legal advice, a New York lawyer must review it before real use.
 * Any change to the wording must bump WAIVER_VERSION; signed copies keep the text they agreed to.
 */
export type WaiverLang = "en" | "es";

export const WAIVER_VERSION = "2026-11-v1";

/** Room above the guest count for a swapped-in friend or a parent signing as well. */
const SIGNER_SLACK = 2;

export const WAIVER_COPY = {
  en: {
    title: "Participation and recording release",
    intro: "Please read this before your session. It's written in plain language, and if anything is unclear you can ask Alex before you sign.",
    sections: [
      {
        heading: "Your session",
        body: "I'm taking part in a private music session with Raw Planet in a working studio in New York. Depending on the experience, it can involve loud sound, studio equipment and cables, and movement or breathing exercises.",
      },
      {
        heading: "Looking after yourself and the studio",
        body: "I'll follow the host's instructions and treat the equipment with care. I'll tell the host about anything that could affect me during the session, such as a health condition or sensitivity to loud sound. I can take a break or stop at any time.",
      },
      {
        heading: "Risk and responsibility",
        body: "I understand that any activity like this carries some risk, and I choose to take part. As far as the law allows, I accept responsibility for the ordinary risks of the session and agree not to hold Raw Planet or its host responsible for them. This doesn't take away any rights that the law says can't be given up.",
      },
    ],
    recording: {
      heading: "Recording and photos (optional)",
      body: "I agree that Raw Planet can record audio and video of me and take photos during the session, and can use them on its website, on social media and in its marketing, without payment to me. If I change my mind later, I can write to Raw Planet and it will stop using them in anything new.",
    },
    minor: {
      heading: "Signing for a minor",
      body: "If I name a minor when I sign, I confirm that I'm their parent or legal guardian and that I agree to all of this on their behalf.",
    },
    ui: {
      pageTitle: "Sign your waiver",
      each: "Everyone signs for themselves on this same link, so feel free to pass it around your group.",
      count: (n: number, guests: number) => `${n} of ${guests} ${guests === 1 ? "guest has" : "guests have"} signed so far.`,
      name: "Your full name",
      nameHint: "Typing your name here counts as your signature.",
      agree: "I've read this and I agree to it.",
      recording: "Yes, I agree to the recording and photo terms above.",
      recordingHint: "This one is up to you. You can still take part if you leave it unticked, and we'll keep you out of anything we share publicly.",
      forMinor: "I am signing for a minor",
      minorName: "The minor's full name",
      minorHint: "One signature per minor. If you have two, sign once for each.",
      submit: "Sign",
      sending: "Signing…",
      errName: "Please type your full name.",
      errAgree: "Please tick the box to agree before you sign.",
      errMinor: "Please add the minor's full name.",
      errNetwork: "We couldn't reach the server. Check your connection and try again.",
      errGeneric: "Something went wrong. Please try again.",
      errRate: "Too many tries. Please wait a minute and try again.",
      doneTitle: "Thank you, you're signed.",
      doneMore: "Sign for someone else",
      badTitle: "This link doesn't look right.",
      badBody: "Waiver links only work exactly as they were sent. Please open the link from your booking email, or ask the person who shared it to send it again.",
      closedTitle: "This booking is closed.",
      closedBody: "This booking is no longer active, so it can't take new signatures. If that doesn't sound right, please get in touch.",
      fullTitle: "Everyone has signed.",
      fullBody: "This booking has all the signatures it can take. If you still need to sign, please get in touch and Alex will sort it out.",
      contact: "Contact us",
      otherLang: "Español",
    },
  },
  es: {
    title: "Autorización de participación y grabación",
    intro: "Léela antes de tu sesión. Está escrita en lenguaje sencillo y, si algo no queda claro, puedes preguntarle a Alex antes de firmar.",
    sections: [
      {
        heading: "Tu sesión",
        body: "Voy a participar en una sesión privada de música con Raw Planet en un estudio en funcionamiento en Nueva York. Según la experiencia, puede incluir sonido fuerte, equipos de estudio y cables, y ejercicios de movimiento o respiración.",
      },
      {
        heading: "Cuidar de ti y del estudio",
        body: "Seguiré las indicaciones del anfitrión y trataré los equipos con cuidado. Le avisaré de cualquier cosa que pueda afectarme durante la sesión, como una condición de salud o sensibilidad al sonido fuerte. Puedo hacer una pausa o parar en cualquier momento.",
      },
      {
        heading: "Riesgo y responsabilidad",
        body: "Entiendo que una actividad como esta conlleva algún riesgo y elijo participar. En la medida en que la ley lo permita, acepto la responsabilidad por los riesgos normales de la sesión y acepto no responsabilizar de ellos a Raw Planet ni a su anfitrión. Esto no me quita ningún derecho al que la ley no permita renunciar.",
      },
    ],
    recording: {
      heading: "Grabación y fotos (opcional)",
      body: "Acepto que Raw Planet grabe audio y video de mí y tome fotos durante la sesión, y que los use en su sitio web, en redes sociales y en su publicidad, sin pagarme por ello. Si más adelante cambio de opinión, puedo escribir a Raw Planet y dejará de usarlos en cualquier material nuevo.",
    },
    minor: {
      heading: "Firmar por un menor",
      body: "Si indico el nombre de un menor al firmar, confirmo que soy su madre, padre o tutor legal y que acepto todo esto en su nombre.",
    },
    ui: {
      pageTitle: "Firma tu autorización",
      each: "Cada persona firma por sí misma en este mismo enlace, así que puedes compartirlo con tu grupo.",
      count: (n: number, guests: number) => `${n} de ${guests} ${guests === 1 ? "persona ha firmado" : "personas han firmado"} hasta ahora.`,
      name: "Tu nombre completo",
      nameHint: "Escribir tu nombre aquí cuenta como tu firma.",
      agree: "He leído esto y estoy de acuerdo.",
      recording: "Sí, acepto las condiciones de grabación y fotos de arriba.",
      recordingHint: "Esto lo decides tú. Puedes participar igual si no lo marcas, y te dejaremos fuera de todo lo que compartamos públicamente.",
      forMinor: "Estoy firmando por un menor",
      minorName: "Nombre completo del menor",
      minorHint: "Una firma por cada menor. Si son dos, firma una vez por cada uno.",
      submit: "Firmar",
      sending: "Firmando…",
      errName: "Escribe tu nombre completo.",
      errAgree: "Marca la casilla para aceptar antes de firmar.",
      errMinor: "Agrega el nombre completo del menor.",
      errNetwork: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
      errGeneric: "Algo salió mal. Inténtalo de nuevo.",
      errRate: "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
      doneTitle: "Gracias, ya firmaste.",
      doneMore: "Firmar por otra persona",
      badTitle: "Este enlace no parece correcto.",
      badBody: "Los enlaces de autorización solo funcionan tal como se enviaron. Abre el enlace del correo de tu reserva, o pídele a quien te lo compartió que lo envíe de nuevo.",
      closedTitle: "Esta reserva está cerrada.",
      closedBody: "Esta reserva ya no está activa, así que no admite más firmas. Si crees que es un error, escríbenos.",
      fullTitle: "Ya firmaron todos.",
      fullBody: "Esta reserva ya tiene todas las firmas que admite. Si aún necesitas firmar, escríbenos y Alex lo resuelve.",
      contact: "Escríbenos",
      otherLang: "English",
    },
  },
};

/** The full wording as signed, stored with each signature. Consent choices live in their own columns. */
export function waiverSnapshot(lang: WaiverLang): string {
  const c = WAIVER_COPY[lang];
  return [c.title, c.intro, ...[...c.sections, c.recording, c.minor].map((s) => `${s.heading}\n${s.body}`)].join("\n\n");
}

/** Stored version: the wording revision plus the language it was read in. */
export const waiverVersion = (lang: WaiverLang) => `${WAIVER_VERSION}-${lang}`;

export const waiverSignerLimit = (guests: number) => guests + SIGNER_SLACK;

export function signingState(b: { status: string; guests: number }, signed: number): "open" | "full" | "closed" {
  if (b.status !== "confirmed" && b.status !== "completed") return "closed";
  return signed >= waiverSignerLimit(b.guests) ? "full" : "open";
}

const norm = (s: string | null) => (s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** A double tap or a reopened link must not count as a second guest. A parent signing for two minors is two signers. */
export function alreadySigned(existing: { signerName: string; minorName: string | null }[], s: { signerName: string; minorName: string | null }): boolean {
  return existing.some((e) => norm(e.signerName) === norm(s.signerName) && norm(e.minorName) === norm(s.minorName));
}
