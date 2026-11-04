import "server-only";
import { asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, customers, eventRsvps, events, experiences, giftCards, inquiries } from "@/lib/db/schema";

export type CustomerSort = "recent" | "spent" | "sessions" | "name";
export type CustomerFilters = { q: string; sort: CustomerSort; optIn: boolean; page: number };
type SP = Record<string, string | string[] | undefined> | URLSearchParams;
const one = (sp: SP, k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? "" : ((Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined) ?? "");

export function parseCustomerFilters(sp: SP): CustomerFilters {
  const sort = one(sp, "sort") as CustomerSort;
  return {
    q: one(sp, "q").trim().slice(0, 100),
    sort: (["recent", "spent", "sessions", "name"] as const).includes(sort) ? sort : "recent",
    optIn: one(sp, "optin") === "1",
    page: Math.max(1, Math.min(1000, Number(one(sp, "page")) || 1)),
  };
}
export function customerQuery(f: CustomerFilters, patch: Partial<CustomerFilters> = {}) {
  const m = { ...f, ...patch };
  const p = new URLSearchParams();
  if (m.q) p.set("q", m.q);
  if (m.sort !== "recent") p.set("sort", m.sort);
  if (m.optIn) p.set("optin", "1");
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const CUSTOMER_PAGE = 50;

/** Customers with lifetime stats. Real email only (manual bookings without email use @rawplanet.invalid). */
export async function listCustomers(f: CustomerFilters, opts: { limit?: number } = {}) {
  const db = await getDb();
  const live = sql`b.status in ('confirmed','completed','no_show')`;
  const stats = db
    .select({
      customerId: sql<string>`b.customer_id`.as("customer_id"),
      sessions: sql<number>`count(*) filter (where ${live})::int`.as("sessions"),
      spent: sql<number>`coalesce(sum(b.amount_paid_cents - b.amount_refunded_cents) filter (where b.status <> 'pending_payment' and b.status <> 'expired'), 0)::int`.as("spent"),
      lastAt: sql<Date | null>`max(b.start_at) filter (where ${live} and b.start_at <= now())`.as("last_at"),
      nextAt: sql<Date | null>`min(b.start_at) filter (where b.status = 'confirmed' and b.start_at > now())`.as("next_at"),
      sources: sql<string[]>`array_agg(distinct b.source)`.as("sources"),
    })
    .from(sql`${bookings} b`)
    .groupBy(sql`b.customer_id`)
    .as("s");

  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(customers.name, like), ilike(customers.email, like), ilike(customers.phone, like))!);
  }
  if (f.optIn) where.push(eq(customers.marketingOptIn, true));
  const order =
    f.sort === "spent"
      ? [desc(sql`coalesce(${stats.spent}, 0)`), asc(customers.name)]
      : f.sort === "sessions"
        ? [desc(sql`coalesce(${stats.sessions}, 0)`), asc(customers.name)]
        : f.sort === "name"
          ? [asc(customers.name)]
          : [desc(sql`greatest(coalesce(${stats.nextAt}, ${stats.lastAt}), ${customers.createdAt})`)];
  const limit = opts.limit ?? CUSTOMER_PAGE;
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      marketingOptIn: customers.marketingOptIn,
      language: customers.language,
      createdAt: customers.createdAt,
      sessions: sql<number>`coalesce(${stats.sessions}, 0)`,
      spent: sql<number>`coalesce(${stats.spent}, 0)`,
      lastAt: stats.lastAt,
      nextAt: stats.nextAt,
      sources: stats.sources,
    })
    .from(customers)
    .leftJoin(stats, eq(stats.customerId, customers.id))
    .where(where.length ? sql.join(where, sql` and `) : undefined)
    .orderBy(...order)
    .limit(limit + 1)
    .offset(opts.limit ? 0 : (f.page - 1) * CUSTOMER_PAGE);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(customers);
  return {
    rows: rows.slice(0, limit).map((r) => ({
      ...r,
      sessions: Number(r.sessions),
      spent: Number(r.spent),
      lastAt: r.lastAt ? new Date(r.lastAt) : null,
      nextAt: r.nextAt ? new Date(r.nextAt) : null,
      sources: (r.sources ?? []).filter(Boolean),
      hasEmail: !r.email.endsWith("@rawplanet.invalid"),
    })),
    hasMore: rows.length > limit,
    total: Number(n),
  };
}

export async function getCustomerDetail(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return null;
  const [bk, cards, inq, rsvps] = await Promise.all([
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        source: bookings.source,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
        guests: bookings.guests,
        paid: bookings.amountPaidCents,
        refunded: bookings.amountRefundedCents,
        occasion: bookings.occasion,
        experience: experiences.shortName,
        theme: experiences.theme,
      })
      .from(bookings)
      .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
      .where(or(eq(bookings.customerId, c.id), eq(bookings.contactEmail, c.email)))
      .orderBy(desc(bookings.startAt)),
    db
      .select()
      .from(giftCards)
      .where(or(eq(giftCards.purchaserEmail, c.email), eq(giftCards.recipientEmail, c.email)))
      .orderBy(desc(giftCards.createdAt)),
    db.select().from(inquiries).where(eq(sql`lower(${inquiries.email})`, c.email)).orderBy(desc(inquiries.createdAt)),
    db
      .select({ id: eventRsvps.id, guests: eventRsvps.guests, status: eventRsvps.status, eventId: events.id, title: events.title, startAt: events.startAt })
      .from(eventRsvps)
      .innerJoin(events, eq(events.id, eventRsvps.eventId))
      .where(eq(sql`lower(${eventRsvps.email})`, c.email))
      .orderBy(desc(events.startAt)),
  ]);
  return { customer: c, bookings: bk, giftCards: cards, inquiries: inq, rsvps };
}
