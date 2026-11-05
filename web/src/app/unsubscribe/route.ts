/**
 * Public unsubscribe. A route rather than a page because RFC 8058 mail clients POST straight to
 * this URL. GET only shows a button: mail scanners follow links, and a scanner must never
 * unsubscribe anyone.
 */
import { unsubscribeCustomer } from "@/lib/admin/campaigns";
import { BUSINESS } from "@/lib/config";
import { unsubTokenValid } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    ask: "Stop news from Raw Planet?",
    askBody: "You'll stop getting news and offers. Emails about sessions you book still arrive.",
    button: "Unsubscribe",
    done: "You're unsubscribed",
    doneBody: "We won't send you any more news or offers. Thanks for being part of Raw Planet.",
    bad: "This link doesn't look right",
    badBody: `Open the unsubscribe link straight from your email, or write to ${BUSINESS.contactEmail} and we'll take you off the list.`,
  },
  es: {
    ask: "¿Dejar de recibir novedades de Raw Planet?",
    askBody: "Dejarás de recibir novedades y ofertas. Los correos sobre las sesiones que reserves te seguirán llegando.",
    button: "Darme de baja",
    done: "Te has dado de baja",
    doneBody: "No te enviaremos más novedades ni ofertas. Gracias por ser parte de Raw Planet.",
    bad: "Este enlace no parece correcto",
    badBody: `Abre el enlace de baja directamente desde tu correo, o escribe a ${BUSINESS.contactEmail} y te quitaremos de la lista.`,
  },
};

function page(lang: "en" | "es", title: string, body: string, status: number, form = "") {
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · Raw Planet</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px; box-sizing: border-box; background: #fffaf1; color: #3a2212; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 420px; }
  h1 { font-size: 28px; line-height: 1.15; margin: 0 0 12px; }
  p { margin: 0 0 20px; color: #6e5747; }
  button { min-height: 46px; padding: 0 24px; border: 0; border-radius: 999px; background: #b8482e; color: #fff; font: 700 16px system-ui, sans-serif; cursor: pointer; }
  button:focus-visible { outline: 3px solid #3a2212; outline-offset: 2px; }
</style>
</head>
<body><main><h1>${title}</h1><p>${body}</p>${form}</main></body>
</html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

function read(req: Request) {
  const q = new URL(req.url).searchParams;
  const lang = q.get("l") === "es" ? ("es" as const) : ("en" as const);
  const id = q.get("c") ?? "";
  return { lang, t: COPY[lang], id, ok: unsubTokenValid(id, q.get("t") ?? "") };
}

export async function GET(req: Request) {
  const { lang, t, ok } = read(req);
  if (!ok) return page(lang, t.bad, t.badBody, 400);
  // No action attribute: the form posts back to this same signed URL.
  return page(lang, t.ask, t.askBody, 200, `<form method="post"><button type="submit">${t.button}</button></form>`);
}

/** Both the button above and one-click mail clients. Any POST with a valid token unsubscribes. */
export async function POST(req: Request) {
  const { lang, t, id, ok } = read(req);
  if (!ok) return page(lang, t.bad, t.badBody, 400);
  await unsubscribeCustomer(id);
  return page(lang, t.done, t.doneBody, 200);
}
