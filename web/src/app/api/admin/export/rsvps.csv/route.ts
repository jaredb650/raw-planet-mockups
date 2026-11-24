import { asc, eq } from "drizzle-orm";
import { adminGuard } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eventRsvps, events } from "@/lib/db/schema";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { fmt } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("event") ?? "";
  const db = await getDb();
  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) return Response.json({ error: "Event not found" }, { status: 404 });
  const rows = await db.select().from(eventRsvps).where(eq(eventRsvps.eventId, ev.id)).orderBy(asc(eventRsvps.createdAt));
  const body = toCsv(
    ["Name", "Email", "People", "Status", "RSVP'd"],
    rows.map((r) => [r.name, r.email, r.guests, r.status, fmt(r.createdAt, "yyyy-MM-dd HH:mm")]),
  );
  return csvResponse(`rsvps-${ev.slug}.csv`, body);
}
