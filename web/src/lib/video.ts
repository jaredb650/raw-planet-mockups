/**
 * Guest video testimonials. Accepted: YouTube, Vimeo, or a direct .mp4/.webm/.mov file
 * (https, or a /media/… path in this site). Anything else is rejected, so no arbitrary iframes.
 */
export type VideoEmbed = { kind: "iframe"; src: string } | { kind: "file"; src: string };

export function videoEmbed(raw: string | null | undefined): VideoEmbed | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^\/media\/[\w/.-]+\.(mp4|webm|mov)$/i.test(s) && !s.includes("..")) return { kind: "file", src: s };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt =
    host === "youtu.be" ? u.pathname.slice(1) : host === "youtube.com" ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]) : null;
  if (yt && /^[\w-]{11}$/.test(yt)) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt}` };
  const vimeo = host === "vimeo.com" ? u.pathname.match(/^\/(\d+)/)?.[1] : null;
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo}?dnt=1` };
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "file", src: u.toString() };
  return null;
}
