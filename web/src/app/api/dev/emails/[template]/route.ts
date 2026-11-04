/**
 * Email preview (dev, or signed-in admin in production).
 *
 *   /api/dev/emails/index                     → list of every template (EN + ES links)
 *   /api/dev/emails/<template>?lang=es        → rendered HTML
 *   ...&theme=dj|production|wellness          → experience accent / copy
 *   ...&format=text | json                    → plain-text part, or {subject, html, text}
 *   ...&frame=390                             → the email inside a 390px-wide iframe (phone layout,
 *                                               since desktop Chrome won't go narrower than ~500px)
 */
import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { langOf } from "@/emails/i18n";
import { renderEmail } from "@/emails/render";
import { TEMPLATES } from "@/emails/samples";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function GET(req: NextRequest, ctx: { params: Promise<{ template: string }> }) {
  if (process.env.NODE_ENV === "production" && !(await isAdmin())) return new Response("Not found", { status: 404 });
  const { template } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const lang = langOf(sp.get("lang"));
  const theme = ["production", "dj", "wellness"].includes(sp.get("theme") ?? "") ? sp.get("theme")! : "production";

  if (template === "index") {
    const rows = await Promise.all(
      Object.entries(TEMPLATES).map(async ([key, t]) => {
        const en = t.render({ lang: "en", theme });
        const es = t.render({ lang: "es", theme });
        return `<tr><td><code>${key}</code></td><td>${esc(t.label)}</td><td><a href="./${key}?lang=en&theme=${theme}">EN</a> · <a href="./${key}?lang=es&theme=${theme}">ES</a> · <a href="./${key}?format=text&theme=${theme}">text</a></td><td>${esc(en.subject)}<br><small>${esc(es.subject)}</small></td></tr>`;
      }),
    );
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email previews</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;background:#F7E7C6;color:#3A2212}main{max-width:1100px;margin:auto}table{border-collapse:collapse;width:100%;background:#FFFDF8;border-radius:12px;overflow:hidden}td,th{padding:10px 12px;border-bottom:1px solid #EAD9BB;text-align:left;vertical-align:top}a{color:#B8482E;font-weight:600}small{color:#6E5747}nav a{margin-right:12px}</style></head>
<body><main><h1>Email previews</h1><nav>Theme: <a href="?theme=production">production</a><a href="?theme=dj">dj</a><a href="?theme=wellness">wellness</a></nav><p>${Object.keys(TEMPLATES).length} templates. Subjects shown EN / ES.</p>
<table><thead><tr><th>Key</th><th>Template</th><th>Open</th><th>Subject</th></tr></thead><tbody>${rows.join("")}</tbody></table></main></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const frame = Number(sp.get("frame"));
  if (frame >= 280 && frame <= 1200) {
    const inner = new URLSearchParams(sp);
    inner.delete("frame");
    const src = `./${encodeURIComponent(template)}?${inner.toString()}`;
    const page = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(template)} @ ${frame}px</title>
<style>html,body{margin:0;background:#2b2b2b}iframe{display:block;border:0;width:${frame}px;height:100vh;background:#fff}</style></head>
<body><iframe id="f" src="${esc(src)}" title="${esc(template)}"></iframe>
<script>const f=document.getElementById("f");f.addEventListener("load",()=>{f.style.height=f.contentDocument.documentElement.scrollHeight+"px"});</script></body></html>`;
    return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const entry = TEMPLATES[template];
  if (!entry) return Response.json({ error: `Unknown template "${template}"`, templates: Object.keys(TEMPLATES) }, { status: 404 });
  const out = await renderEmail(entry.render({ lang, theme }));
  const format = sp.get("format");
  if (format === "json") return Response.json(out);
  if (format === "text") return new Response(`Subject: ${out.subject}\n\n${out.text}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(out.html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Email-Subject": encodeURIComponent(out.subject) } });
}
