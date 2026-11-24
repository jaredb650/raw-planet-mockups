/**
 * Language + New York time formatting for emails. Guest-facing emails are
 * sent in Spanish when the booking (or customer) language is "es".
 */
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { BUSINESS } from "@/lib/config";
import { formatMoney } from "@/lib/money";

export type Lang = "en" | "es";
export const langOf = (v: string | null | undefined): Lang => (v === "es" ? "es" : "en");

const TZ = BUSINESS.timeZone;
const local = (d: Date | string) => new TZDate(new Date(d), TZ);

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Saturday, November 14" · "sábado 14 de noviembre" */
export function fmtDay(d: Date | string, lang: Lang): string {
  return lang === "es" ? format(local(d), "EEEE d 'de' MMMM", { locale: esLocale }) : format(local(d), "EEEE, MMMM d");
}

/** "Saturday, November 14, 2026" · "sábado 14 de noviembre de 2026" */
export function fmtDayYear(d: Date | string, lang: Lang): string {
  return lang === "es" ? format(local(d), "EEEE d 'de' MMMM 'de' yyyy", { locale: esLocale }) : format(local(d), "EEEE, MMMM d, yyyy");
}

/** "Sat, Nov 14" · "sáb 14 nov" */
export function fmtDayShort(d: Date | string, lang: Lang): string {
  return lang === "es" ? format(local(d), "EEE d MMM", { locale: esLocale }).replace(/\./g, "") : format(local(d), "EEE, MMM d");
}

/** "2pm", "2:30pm" · "2:00 p. m." */
export function fmtClock(d: Date | string, lang: Lang): string {
  const t = local(d);
  if (lang === "es") return `${format(t, "h:mm")} ${t.getHours() < 12 ? "a. m." : "p. m."}`;
  return t.getMinutes() === 0 ? format(t, "haaa") : format(t, "h:mmaaa");
}

/** End a sentence after a time without doubling the period of "p. m.". */
export const withDot = (s: string) => (s.endsWith(".") ? s : `${s}.`);

export function fmtRange(a: Date | string, b: Date | string, lang: Lang): string {
  return `${fmtClock(a, lang)} – ${fmtClock(b, lang)}`;
}

/** "Friday, November 13 at 2pm" · "viernes 13 de noviembre a las 2:00 p. m." */
export function fmtDayAt(d: Date | string, lang: Lang): string {
  const t = local(d);
  if (lang === "es") return `${fmtDay(d, lang)} a la${t.getHours() % 12 === 1 ? "" : "s"} ${fmtClock(d, lang)}`;
  return `${fmtDay(d, lang)} at ${fmtClock(d, lang)}`;
}

export function fmtDur(minutes: number, lang: Lang): string {
  const h = minutes / 60;
  if (lang === "es") {
    if (minutes % 30 === 0 && minutes >= 60) return `${String(h).replace(".", ",")} ${h === 1 ? "hora" : "horas"}`;
    return `${minutes} minutos`;
  }
  if (minutes % 30 === 0 && minutes >= 60) return `${h} ${h === 1 ? "hour" : "hours"}`;
  return `${minutes} minutes`;
}

export function fmtGuests(n: number, lang: Lang): string {
  return lang === "es" ? `${n} ${n === 1 ? "persona" : "personas"}` : `${n} ${n === 1 ? "guest" : "guests"}`;
}

export const money = (cents: number) => formatMoney(cents);

export const nyTime = (lang: Lang) => (lang === "es" ? "hora de Nueva York" : "New York time");

/** Greeting name: letters only, max 24 chars, so a form can't smuggle links or text into our emails. */
export const firstName = (name: string) => name.trim().match(/^[\p{L}\p{M}'’-]{1,24}/u)?.[0] ?? "";

/** Experience names by theme (DB copy is English-only). */
export function experienceName(e: { name: string; theme: string }, lang: Lang): string {
  if (lang !== "es") return e.name;
  return (
    { production: "Experiencia de producción musical", dj: "Experiencia de DJ", wellness: "Experiencia de meditación" }[e.theme] ?? e.name
  );
}

/**
 * Spanish versions of the stock experience copy (includes / good-to-know /
 * arrival). Anything Alex writes himself in admin passes through unchanged.
 */
const ES: Record<string, string> = {
  "All studio gear and software": "Todo el equipo y software del estudio",
  "A bounced audio file of the music you create": "Un archivo de audio con la música que crees",
  "Pictures from your experience": "Fotos de tu experiencia",
  "All DJ gear and headphones": "Todo el equipo de DJ y audífonos",
  "A recording of the mix you create": "Una grabación de la mezcla que crees",
  "Mats and cushions": "Colchonetas y cojines",
  "Live sound": "Sonido en vivo",
  "Access to the full meditation recording": "Acceso a la grabación completa de la meditación",
  "The original musical compositions created for the experience": "Las composiciones musicales originales creadas para la experiencia",
  "Ages 10 and up": "Para mayores de 10 años",
  "Shared session, up to 15 guests": "Sesión compartida, hasta 15 personas",
  "Shared session, up to 5 guests": "Sesión compartida, hasta 5 personas",
  "Extra hours are $150 per hour": "Las horas adicionales cuestan $150 por hora",
  "Each participant prepares 5 songs for their recorded mix": "Cada participante prepara 5 canciones para su mezcla grabada",
  "Minimum booking of 6 guests": "Reserva mínima de 6 personas",
  "Up to 15 guests per session": "Hasta 15 personas por sesión",
  "Sessions in English or Spanish": "Sesiones en inglés o en español",
  "Wear comfortable clothes": "Ven con ropa cómoda",
  "Please arrive on time. Sessions are scheduled and reserved in advance, so we can't guarantee extra time for late arrivals":
    "Por favor llega a tiempo. Las sesiones se programan y reservan con anticipación, así que no podemos garantizar tiempo adicional si llegas tarde",
  "Press the buzzer when you arrive and we'll bring you upstairs. Please arrive on time.": "Cuando llegues, toca el timbre y te subimos al estudio. Por favor llega a tiempo.",
  "Please arrive on time, with your 5 songs ready.": "Por favor llega a tiempo, con tus 5 canciones listas.",
  "Please arrive on time so the session can start together.": "Por favor llega a tiempo para que la sesión empiece con todos.",
};
export const tr = (s: string, lang: Lang) => (lang === "es" ? (ES[s.trim()] ?? s) : s);
