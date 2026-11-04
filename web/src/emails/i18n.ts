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
    { production: "Sesión de producción musical", dj: "Sesión de DJ", wellness: "Meditación con sonido" }[e.theme] ?? e.name
  );
}

/**
 * Spanish versions of the stock experience copy (includes / good-to-know /
 * arrival). Anything Alex writes himself in admin passes through unchanged.
 */
const ES: Record<string, string> = {
  "All studio gear and software": "Todo el equipo y software del estudio",
  "A private session with Alex": "Una sesión privada con Alex",
  "Your finished track, sent after your visit": "Tu canción terminada, enviada después de tu visita",
  "All DJ gear and headphones": "Todo el equipo de DJ y audífonos",
  "Music library — or bring your own playlist": "Biblioteca de música, o trae tu propia playlist",
  "Mats and cushions": "Colchonetas y cojines",
  "Live sound by Alex": "Sonido en vivo con Alex",
  "Tea and a slow return to the city": "Té y un regreso tranquilo a la ciudad",
  "Ages 10 and up": "Para mayores de 10 años",
  "Press the buzzer and Alex will bring you upstairs": "Toca el timbre y Alex te sube al estudio",
  "Sessions in English or Spanish": "Sesiones en inglés o en español",
  "Great for birthdays and groups of friends": "Ideal para cumpleaños y grupos de amigos",
  "Group bookings only — minimum 10 guests": "Solo reservas de grupo: mínimo 10 personas",
  "Wear comfortable clothes": "Ven con ropa cómoda",
  "Press the buzzer when you arrive and Alex will bring you upstairs.": "Cuando llegues, toca el timbre y Alex te sube al estudio.",
  "Arrive 10 minutes early to settle in.": "Llega 10 minutos antes para acomodarte con calma.",
  "Exact address and entry instructions are in your confirmation email.": "La dirección exacta y cómo entrar están en tu correo de confirmación.",
};
export const tr = (s: string, lang: Lang) => (lang === "es" ? (ES[s.trim()] ?? s) : s);
