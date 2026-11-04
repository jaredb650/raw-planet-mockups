/** Shared voice: Alex's notes, what-to-bring tips and common phrases (EN + ES). */
import { BUSINESS } from "@/lib/config";
import type { Lang } from "./i18n";

export const INSTAGRAM_HANDLE = "@" + BUSINESS.instagram.replace(/\/$/, "").split("/").pop();

export const signoff = (lang: Lang) => (lang === "es" ? "Alex Gentil · productor, DJ y tu anfitrión" : "Alex Gentil · producer, DJ & your host");

export function alexNote(theme: string, lang: Lang): string {
  const en: Record<string, string> = {
    production:
      "No experience needed, I promise. Bring ideas: a song you love, a lyric sitting in your notes app, a vibe. We'll build something from scratch together and you'll walk out with a track that's actually yours. Can't wait.",
    dj: "Never touched a deck? Perfect. By the end you'll be blending songs like you've been doing it for years. Got a playlist you love? Bring it. If not, we have plenty.",
    wellness: "Nothing to prepare and nothing to get right. Come comfortable, leave the city at the door and let the sound do the work.",
  };
  const es: Record<string, string> = {
    production:
      "No necesitas experiencia, te lo prometo. Trae ideas: una canción que te encante, una letra guardada en el celular, un vibe. Armamos algo desde cero y te vas con una canción que de verdad es tuya. ¡Nos vemos pronto!",
    dj: "¿Nunca has tocado unos platos? Perfecto. Al final vas a estar mezclando como si llevaras años haciéndolo. ¿Tienes una playlist favorita? Tráela. Si no, aquí hay música de sobra.",
    wellness: "No hay nada que preparar ni nada que hacer bien o mal. Ven con ropa cómoda, deja la ciudad en la puerta y deja que el sonido haga lo suyo.",
  };
  const fallback = {
    en: "Thanks for booking directly with us. It means a lot to a one-person studio. See you soon!",
    es: "Gracias por reservar directamente con nosotros. Para un estudio de una sola persona significa mucho. ¡Nos vemos pronto!",
  };
  return (lang === "es" ? es : en)[theme] ?? fallback[lang];
}

/** Things to bring (consistent with each experience's "includes" copy). */
export function whatToBring(theme: string, lang: Lang): string[] {
  const en: Record<string, string[]> = {
    production: [
      "Ideas! A song you love, a lyric, a mood. All the gear and software is here.",
      "Your phone, if you want to take photos and video (encouraged).",
    ],
    dj: ["A playlist you love, if you have one (optional: there's a full music library).", "Your phone for photos and a clip of your first mix."],
    wellness: ["Comfortable clothes.", "Nothing else: mats and cushions are provided."],
  };
  const es: Record<string, string[]> = {
    production: [
      "¡Ideas! Una canción que te encante, una letra, un mood. Todo el equipo y el software ya están aquí.",
      "Tu celular, si quieres tomar fotos y videos (muy recomendado).",
    ],
    dj: ["Una playlist que te guste, si tienes (opcional: hay una biblioteca de música completa).", "Tu celular para fotos y un clip de tu primera mezcla."],
    wellness: ["Ropa cómoda.", "Nada más: las colchonetas y los cojines los ponemos nosotros."],
  };
  return (lang === "es" ? es : en)[theme] ?? [];
}

export const L = {
  when: { en: "When", es: "Cuándo" },
  duration: { en: "Length", es: "Duración" },
  guests: { en: "Guests", es: "Personas" },
  where: { en: "Where", es: "Dónde" },
  gettingIn: { en: "Getting in", es: "Cómo llegar" },
  occasion: { en: "Occasion", es: "Ocasión" },
  yourNote: { en: "Your note to Alex", es: "Tu nota para Alex" },
  code: { en: "Booking code", es: "Código de reserva" },
  experience: { en: "Experience", es: "Experiencia" },
  manage: { en: "Manage booking", es: "Gestionar reserva" },
  addGoogle: { en: "Add to Google Calendar", es: "Añadir a Google Calendar" },
  map: { en: "Open in Maps", es: "Abrir en Maps" },
  totalPaid: { en: "Total paid", es: "Total pagado" },
  totalDue: { en: "Total due", es: "Total a pagar" },
  addressSoon: {
    en: "Alex will email the exact address before your session.",
    es: "Alex te enviará la dirección exacta antes de tu sesión.",
  },
  icsNote: {
    en: "A calendar invite (.ics) is attached for Apple Calendar and Outlook.",
    es: "Adjuntamos una invitación de calendario (.ics) para Apple Calendar y Outlook.",
  },
  icsCancelNote: {
    en: "A calendar update (.ics) is attached. Open it to remove the session from your calendar.",
    es: "Adjuntamos una actualización de calendario (.ics). Ábrela para quitar la sesión de tu calendario.",
  },
} as const;

export const t = (k: keyof typeof L, lang: Lang) => L[k][lang];
