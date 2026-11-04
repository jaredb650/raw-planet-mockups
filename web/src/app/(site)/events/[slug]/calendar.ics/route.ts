import { siteUrl } from "@/lib/config";
import { buildIcs } from "@/lib/ics";
import { getPublicEvent } from "@/lib/queries/public";

/** Single-event .ics download for Apple Calendar / Outlook ("Add to calendar"). */
export async function GET(_req: Request, ctx: RouteContext<"/events/[slug]/calendar.ics">) {
  const { slug } = await ctx.params;
  const ev = await getPublicEvent(slug);
  if (!ev) return new Response("Not found", { status: 404 });
  const url = siteUrl(`/events/${ev.slug}`);
  const ics = buildIcs(
    [
      {
        uid: `event-${ev.id}@rawplanetexperiences.com`,
        start: new Date(ev.startAt),
        end: new Date(ev.endAt),
        summary: ev.title,
        description: [ev.summary, url].filter(Boolean).join("\n\n"),
        location: [ev.venue, ev.address].filter(Boolean).join(", "),
        url,
        status: ev.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
      },
    ],
    { name: ev.title, method: "PUBLISH" },
  );
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${ev.slug.replace(/[^a-z0-9-]/gi, "")}.ics"`,
      "cache-control": "public, max-age=300",
    },
  });
}
