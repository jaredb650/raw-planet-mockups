/** Today page "Opportunities": things worth a nudge, all computed from real data. Nothing here sends or changes anything. */
import "server-only";
import { and, asc, desc, eq, gt, gte, isNull, lte, notLike, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, customers, giftCards } from "@/lib/db/schema";
import { loadBusy } from "@/lib/booking/availability";
import { formatMoney } from "@/lib/money";
import { addDaysKey, fmt, fmtTime, overlaps, todayKey, weekdayOf } from "@/lib/time";
import { loadSlotHistory, MIN_BOOKINGS, offeredSlots, type SlotStat } from "./pricing";

const DAY = 86400_000;
const PRIME_RATE = 0.5;
const PRIME_MIN_OPEN = 4;
const NUDGE_AFTER_DAYS = 90;
const NUDGE_STOP_DAYS = 400;
const GIFT_YEAR_DAYS = 365;
const GIFT_WARN_DAYS = 30;

export type Opportunity = { key: string; kind: string; title: string; text: string; href: string };

const isPrime = (s: Pick<SlotStat, "open" | "taken">) => s.open >= PRIME_MIN_OPEN && s.taken / s.open >= PRIME_RATE;

async function emptyPrimeSlots(now: Date): Promise<Opportunity[]> {
  const { exps, stats, bookings: count } = await loadSlotHistory(now);
  const prime = stats.filter(isPrime).sort((a, b) => b.taken / b.open - a.taken / a.open);
  if (count < MIN_BOOKINGS || !prime.length || !exps.length) return [];
  const db = await getDb();
  const today = todayKey(now);
  const busy = await loadBusy(db, { resourceGroup: exps[0].resourceGroup, from: now, to: new Date(now.getTime() + 8 * DAY), now });
  const out: Opportunity[] = [];
  for (let i = 0; i <= 7 && out.length < 3; i++) {
    const dateKey = addDaysKey(today, i);
    const dayPrime = prime.filter((p) => p.weekday === weekdayOf(dateKey));
    for (const p of dayPrime) {
      const exp = exps.find((e) => e.id === p.experienceIds[0]);
      const slot = exp && offeredSlots(exp, dateKey).find((s) => fmt(s.start, "HH:mm") === p.time);
      if (!exp || !slot) continue;
      const start = new Date(slot.start);
      if (start.getTime() < now.getTime() + exp.leadTimeHours * 3600_000) continue;
      if (busy.some((b) => overlaps(start, new Date(slot.end), b.start, b.end))) continue;
      out.push({
        key: `slot-${slot.start}`,
        kind: "Prime time still open",
        title: `${fmt(start, "EEE MMM d")}, ${fmtTime(start)}`,
        text: `This slot was taken on ${p.taken} of the last ${p.open} ${fmt(start, "EEEE")}s and nobody has booked it yet.`,
        href: `/admin/calendar?view=day&date=${dateKey}`,
      });
      break;
    }
  }
  return out;
}

async function guestsDueNudge(now: Date): Promise<Opportunity[]> {
  const db = await getDb();
  const last = sql<Date>`max(${bookings.startAt})`;
  const rows = await db
    .select({ id: customers.id, name: customers.name, sessions: sql<number>`count(*)::int`, last })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(
      and(
        eq(bookings.status, "completed"),
        isNull(customers.unsubscribedAt),
        notLike(customers.email, "%.invalid"),
        sql`not exists (select 1 from bookings u where u.customer_id = ${customers.id} and u.status = 'confirmed' and u.start_at > ${now})`,
      ),
    )
    .groupBy(customers.id, customers.name)
    .having(
      and(
        gte(sql`count(*)`, 2),
        lte(last, new Date(now.getTime() - NUDGE_AFTER_DAYS * DAY)),
        gt(last, new Date(now.getTime() - NUDGE_STOP_DAYS * DAY)),
      ),
    )
    .orderBy(desc(sql`count(*)`), desc(last))
    .limit(3);
  return rows.map((r) => {
    const lastAt = new Date(r.last);
    return {
      key: `guest-${r.id}`,
      kind: "Repeat guest due a nudge",
      title: r.name,
      text: `${r.sessions} sessions so far, the last on ${fmt(lastAt, "MMM d")} (${Math.floor((now.getTime() - lastAt.getTime()) / DAY)} days ago). Nothing booked ahead.`,
      href: `/admin/customers/${r.id}`,
    };
  });
}

async function giftCardsNearYear(now: Date): Promise<Opportunity[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(giftCards)
    .where(
      and(
        eq(giftCards.status, "active"),
        sql`${giftCards.balanceCents} = ${giftCards.initialCents}`,
        lte(giftCards.createdAt, new Date(now.getTime() - (GIFT_YEAR_DAYS - GIFT_WARN_DAYS) * DAY)),
        gt(giftCards.createdAt, new Date(now.getTime() - GIFT_YEAR_DAYS * DAY)),
      ),
    )
    .orderBy(asc(giftCards.createdAt))
    .limit(3);
  return rows.map((g) => ({
    key: `gift-${g.id}`,
    kind: "Gift card unused for nearly a year",
    title: `${formatMoney(g.balanceCents)} for ${g.recipientName ?? g.purchaserName}`,
    text: `Bought ${fmt(g.createdAt, "MMM d, yyyy")} and not spent. A friendly reminder may bring them in.`,
    href: `/admin/gift-cards/${g.id}`,
  }));
}

export async function getOpportunities(now = new Date()): Promise<Opportunity[]> {
  return (await Promise.all([emptyPrimeSlots(now), guestsDueNudge(now), giftCardsNearYear(now)])).flat();
}
