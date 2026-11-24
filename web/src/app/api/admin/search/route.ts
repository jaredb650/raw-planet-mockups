import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { adminGuard } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bookings, customers, experiences, giftCards } from "@/lib/db/schema";
import { BOOKING_STATUS } from "@/components/admin/format";
import { formatMoney } from "@/lib/money";
import { fmt } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Command palette search. Phone numbers match on digits alone, so "9175550142" finds "+1 (917) 555-0142". */
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ groups: [] });
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const digits = q.replace(/\D/g, "");
  const phone = (col: typeof bookings.contactPhone | typeof customers.phone) => (digits.length >= 4 ? sql`regexp_replace(coalesce(${col}, ''), '\\D', '', 'g') like ${`%${digits}%`}` : ilike(col, like));

  const db = await getDb();
  const [bk, people, cards] = await Promise.all([
    db
      .select({ id: bookings.id, code: bookings.code, name: bookings.contactName, startAt: bookings.startAt, status: bookings.status, experience: experiences.shortName })
      .from(bookings)
      .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
      .where(or(ilike(bookings.code, like), ilike(bookings.contactName, like), ilike(bookings.contactEmail, like), phone(bookings.contactPhone)))
      .orderBy(desc(bookings.startAt))
      .limit(6),
    db
      .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone })
      .from(customers)
      .where(or(ilike(customers.name, like), ilike(customers.email, like), phone(customers.phone)))
      .orderBy(desc(customers.createdAt))
      .limit(6),
    db
      .select({ id: giftCards.id, code: giftCards.code, purchaser: giftCards.purchaserName, recipient: giftCards.recipientName, balance: giftCards.balanceCents })
      .from(giftCards)
      .where(or(ilike(giftCards.code, like), ilike(giftCards.purchaserName, like), ilike(giftCards.purchaserEmail, like), ilike(giftCards.recipientName, like), ilike(giftCards.recipientEmail, like)))
      .orderBy(desc(giftCards.createdAt))
      .limit(5),
  ]);

  const groups = [
    {
      label: "Bookings",
      items: bk.map((b) => ({ href: `/admin/bookings/${b.id}`, title: b.name, sub: `${b.code} · ${b.experience} · ${fmt(b.startAt, "MMM d, yyyy")} · ${BOOKING_STATUS[b.status]?.label ?? b.status}` })),
    },
    {
      label: "Customers",
      items: people.map((c) => ({ href: `/admin/customers/${c.id}`, title: c.name, sub: [c.email.endsWith(".invalid") ? null : c.email, c.phone].filter(Boolean).join(" · ") })),
    },
    {
      label: "Gift cards",
      items: cards.map((g) => ({ href: `/admin/gift-cards/${g.id}`, title: g.code, sub: `${g.recipient ?? g.purchaser} · ${formatMoney(g.balance)} left` })),
    },
  ].filter((g) => g.items.length);
  return Response.json({ groups }, { headers: { "Cache-Control": "no-store" } });
}
