/** Guest language from the browser's Accept-Language (no site-wide toggle yet): Spanish first → "es". */
export function requestLang(req: Request): "en" | "es" {
  const first = req.headers.get("accept-language")?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("es") ? "es" : "en";
}
