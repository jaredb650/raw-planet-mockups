import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { blocks, experiences } from "@/lib/db/schema";
import { getCalendarItems, type CalItem } from "@/lib/admin/calendar";
import { addMonthsKey, monthStartKey, weekStartKey } from "@/lib/admin/dashboard";
import { addDaysKey, dateRange, fmt, fmtTime, fmtTimeRange, fromLocal, localDateKey, todayKey } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { BlockForm } from "@/components/admin/BlockForm";
import { ActionForm, ConfirmSubmit } from "@/components/admin/ActionForm";
import { Icon } from "@/components/admin/Icon";
import { themeKey } from "@/components/admin/format";
import { createBlockAction, deleteBlockAction } from "../availability/actions";
import a from "@/components/admin/admin.module.css";
import c from "@/components/admin/cal.module.css";

export const metadata = { title: "Calendar" };

type View = "week" | "day" | "month" | "agenda";
const VIEWS: { v: View; label: string }[] = [
  { v: "day", label: "Day" },
  { v: "week", label: "Week" },
  { v: "month", label: "Month" },
  { v: "agenda", label: "List" },
];
const HOUR_PX = 46;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function itemClass(i: CalItem) {
  if (i.kind === "block") return `${c.item} ${c.k_block}`;
  if (i.kind === "event") return `${c.item} ${c.k_event}`;
  if (i.kind === "hold") return `${c.item} ${c.k_hold}`;
  return `${c.item} ${c[`t_${themeKey(i.theme)}`]} ${i.status === "no_show" ? c.dim : ""}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();
  const today = todayKey(now);
  const view: View = (["week", "day", "month", "agenda"] as const).find((v) => v === one(sp.view)) ?? "week";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : today;
  const sel = one(sp.sel);

  let fromKey: string;
  let toKey: string; // inclusive
  if (view === "day") fromKey = toKey = date;
  else if (view === "week") {
    fromKey = weekStartKey(date);
    toKey = addDaysKey(fromKey, 6);
  } else if (view === "month") {
    fromKey = weekStartKey(monthStartKey(date));
    toKey = addDaysKey(fromKey, 41);
  } else {
    fromKey = date;
    toKey = addDaysKey(date, 29);
  }
  const step = (n: number) =>
    view === "day" ? addDaysKey(date, n) : view === "week" ? addDaysKey(date, 7 * n) : view === "month" ? addMonthsKey(monthStartKey(date), n) : addDaysKey(date, 30 * n);

  const db = await getDb();
  const [items, exps, selBlock] = await Promise.all([
    getCalendarItems(fromLocal(fromKey), fromLocal(addDaysKey(toKey, 1)), now),
    db.select({ id: experiences.id, name: experiences.shortName }).from(experiences).orderBy(asc(experiences.sortOrder)),
    sel ? db.select().from(blocks).where(eq(blocks.id, sel)).limit(1).then((r) => r[0]) : Promise.resolve(undefined),
  ]);
  const days = dateRange(fromKey, toKey);
  const byDay = new Map<string, CalItem[]>();
  for (const d of days) byDay.set(d, []);
  for (const i of items) {
    // An item shows on every local day it touches.
    let k = localDateKey(new Date(i.start));
    const endKey = localDateKey(new Date(new Date(i.end).getTime() - 1));
    if (k < fromKey) k = fromKey;
    for (; k <= endKey && k <= toKey; k = addDaysKey(k, 1)) byDay.get(k)?.push(i);
  }
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ view, date, ...patch });
    if (p.get("view") === "week") p.delete("view");
    if (p.get("date") === today) p.delete("date");
    const s = p.toString();
    return `/admin/calendar${s ? `?${s}` : ""}`;
  };
  const itemHref = (i: CalItem) => (i.kind === "block" ? href({ sel: i.id }) : i.href);

  const title =
    view === "day"
      ? fmt(fromLocal(date, "12:00"), "EEEE, MMMM d")
      : view === "week"
        ? `${fmt(fromLocal(fromKey, "12:00"), "MMM d")} – ${fmt(fromLocal(toKey, "12:00"), fromKey.slice(5, 7) === toKey.slice(5, 7) ? "d" : "MMM d")}`
        : view === "month"
          ? fmt(fromLocal(monthStartKey(date), "12:00"), "MMMM yyyy")
          : `Next 30 days from ${fmt(fromLocal(date, "12:00"), "MMM d")}`;

  return (
    <div className={a.page}>
      <PageHeader
        title="Calendar"
        sub="Sessions, checkout holds, blocked time and synced busy times. Tap an empty hour to book it."
        actions={
          <Link href={`/admin/bookings/new?date=${date}`} className={`${a.btn} ${a.btnPrimary}`}>
            <Icon name="plus" size={16} /> New booking
          </Link>
        }
      />

      {selBlock && (
        <Panel
          title={selBlock.source === "manual" ? "Blocked time" : `Busy time from a synced calendar`}
          action={
            <Link href={href({})} className={`${a.btn} ${a.iconBtn} ${a.btnGhost}`} aria-label="Close">
              <Icon name="close" size={16} />
            </Link>
          }
          className={c.selPanel}
        >
          <div className={a.panelBody}>
            <p>
              <strong>{fmt(selBlock.startAt, "EEE MMM d")}</strong>, {fmtTimeRange(selBlock.startAt, selBlock.endAt)}
              {localDateKey(selBlock.startAt) !== localDateKey(new Date(selBlock.endAt.getTime() - 1)) && ` (until ${fmt(selBlock.endAt, "EEE MMM d")})`}
              {selBlock.reason && <span className={a.muted}> · {selBlock.reason}</span>}
            </p>
            {selBlock.source === "manual" ? (
              <ActionForm action={deleteBlockAction} className={a.row}>
                <input type="hidden" name="id" value={selBlock.id} />
                <ConfirmSubmit confirmLabel="Remove block" question="Make this time bookable again?">
                  Remove block
                </ConfirmSubmit>
              </ActionForm>
            ) : (
              <p className={`${a.small} ${a.muted}`} style={{ marginTop: 6 }}>
                To free it, delete the event in the source calendar. It disappears here on the next sync. <Link href="/admin/availability#feeds">Feeds</Link>
              </p>
            )}
          </div>
        </Panel>
      )}

      <div className={c.toolbar}>
        <div className={a.row} style={{ gap: 6 }}>
          <Link href={href({ date: step(-1) })} className={`${a.btn} ${a.iconBtn}`} aria-label="Previous">
            <Icon name="left" size={16} />
          </Link>
          <Link href={href({ date: today })} className={a.btn}>
            Today
          </Link>
          <Link href={href({ date: step(1) })} className={`${a.btn} ${a.iconBtn}`} aria-label="Next">
            <Icon name="right" size={16} />
          </Link>
          <h2 className={c.range}>{title}</h2>
        </div>
        <nav className={c.seg} aria-label="Calendar view">
          {VIEWS.map(({ v, label }) => (
            <Link key={v} href={href({ view: v })} className={`${c.segBtn} ${view === v ? c.segOn : ""}`} aria-current={view === v ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {(view === "week" || view === "day") && (
        <>
          <TimeGrid days={days} byDay={byDay} today={today} now={now} itemHref={itemHref} single={view === "day"} />
          {view === "week" && <DayList days={days} byDay={byDay} today={today} itemHref={itemHref} className={c.phoneOnly} />}
        </>
      )}
      {view === "month" && <MonthGrid days={days} byDay={byDay} today={today} month={date.slice(0, 7)} itemHref={itemHref} dayHref={(d) => href({ view: "day", date: d })} />}
      {view === "agenda" && <DayList days={days} byDay={byDay} today={today} itemHref={itemHref} hideEmpty />}

      <ul className={c.legend} aria-label="Legend">
        <li><span className={`${c.key} ${c.t_production}`} /> Production</li>
        <li><span className={`${c.key} ${c.t_dj}`} /> DJ</li>
        <li><span className={`${c.key} ${c.t_wellness}`} /> Wellness</li>
        <li><span className={`${c.key} ${c.k_hold}`} /> Paying now</li>
        <li><span className={`${c.key} ${c.k_block}`} /> Blocked / busy</li>
        <li><span className={`${c.key} ${c.k_event}`} /> Community event</li>
      </ul>

      <details className={`${a.panel} ${a.section}`} id="block">
        <summary className={c.blockSummary}>
          <Icon name="availability" size={16} /> Block time off
        </summary>
        <div className={a.disclosureBody}>
          <BlockForm action={createBlockAction} experiences={exps} defaultDate={date} idPrefix="cal" />
        </div>
      </details>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function minutesInto(dayKey: string, iso: string) {
  return (new Date(iso).getTime() - fromLocal(dayKey).getTime()) / 60000;
}
const isAllDay = (i: CalItem) => new Date(i.end).getTime() - new Date(i.start).getTime() >= 20 * 3600_000;

/** Lay overlapping items side by side. */
function lanes(list: CalItem[]) {
  const out: { item: CalItem; lane: number; lanes: number }[] = [];
  let group: typeof out = [];
  let groupEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => (g.lanes = n));
    out.push(...group);
    group = [];
  };
  for (const item of list) {
    const s = new Date(item.start).getTime();
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => new Date(g.item.end).getTime() > s).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, new Date(item.end).getTime());
  }
  if (group.length) flush();
  return out;
}

function TimeGrid({
  days,
  byDay,
  today,
  now,
  itemHref,
  single,
}: {
  days: string[];
  byDay: Map<string, CalItem[]>;
  today: string;
  now: Date;
  itemHref: (i: CalItem) => string;
  single: boolean;
}) {
  let minH = 9;
  let maxH = 22;
  for (const d of days)
    for (const i of byDay.get(d) ?? []) {
      if (isAllDay(i)) continue;
      minH = Math.min(minH, Math.max(0, Math.floor(minutesInto(d, i.start) / 60)));
      maxH = Math.max(maxH, Math.min(24, Math.ceil(minutesInto(d, i.end) / 60)));
    }
  const hours = Array.from({ length: maxH - minH }, (_, k) => minH + k);
  const hasAllDay = days.some((d) => (byDay.get(d) ?? []).some(isAllDay));
  const nowMin = minutesInto(today, now.toISOString());
  return (
    <div className={`${a.panel} ${c.grid} ${single ? "" : c.desktopOnly}`} style={{ ["--days" as string]: days.length }}>
      <div className={c.gridHead}>
        <span />
        {days.map((d) => (
          <Link key={d} href={`/admin/calendar?view=day&date=${d}`} className={`${c.colHead} ${d === today ? c.isToday : ""}`}>
            <span className={c.dow}>{fmt(fromLocal(d, "12:00"), "EEE")}</span>
            <span className={c.dnum}>{fmt(fromLocal(d, "12:00"), "d")}</span>
          </Link>
        ))}
      </div>
      {hasAllDay && (
        <div className={c.allDayRow}>
          <span className={c.hourLabel}>All day</span>
          {days.map((d) => (
            <div key={d} className={c.allDayCell}>
              {(byDay.get(d) ?? []).filter(isAllDay).map((i) => (
                <Link key={i.id} href={itemHref(i)} className={itemClass(i)}>
                  <span className={c.itTitle}>{i.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className={c.body} style={{ height: hours.length * HOUR_PX }}>
        <div className={c.hours}>
          {hours.map((h) => (
            <span key={h} className={c.hourLabel} style={{ top: (h - minH) * HOUR_PX }}>
              {h === 0 || h === 24 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className={`${c.col} ${d === today ? c.colToday : ""}`}>
            {hours.map((h) => (
              <Link
                key={h}
                href={`/admin/bookings/new?date=${d}&time=${String(h).padStart(2, "0")}:00`}
                className={c.slotLink}
                style={{ top: (h - minH) * HOUR_PX, height: HOUR_PX }}
                aria-label={`New booking ${fmt(fromLocal(d, "12:00"), "EEE MMM d")} at ${h > 12 ? h - 12 : h}${h >= 12 ? "pm" : "am"}`}
                tabIndex={-1}
              />
            ))}
            {d === today && nowMin > minH * 60 && nowMin < maxH * 60 && <span className={c.nowLine} style={{ top: (nowMin / 60 - minH) * HOUR_PX }} aria-hidden />}
            {lanes((byDay.get(d) ?? []).filter((i) => !isAllDay(i))).map(({ item: i, lane, lanes: n }) => {
              const top = Math.max(0, minutesInto(d, i.start) / 60 - minH) * HOUR_PX;
              const bottom = Math.min(hours.length, minutesInto(d, i.end) / 60 - minH) * HOUR_PX;
              return (
                <Link
                  key={`${i.kind}-${i.id}`}
                  href={itemHref(i)}
                  className={`${itemClass(i)} ${c.abs}`}
                  style={{ top, height: Math.max(22, bottom - top - 2), left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}
                  title={`${fmtTimeRange(i.start, i.end)} · ${i.title} · ${i.sub}`}
                >
                  <span className={c.itTime}>{fmtTime(i.start)}</span>
                  <span className={c.itTitle}>{i.title}</span>
                  {bottom - top > 50 && <span className={c.itSub}>{i.sub}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayList({
  days,
  byDay,
  today,
  itemHref,
  className,
  hideEmpty,
}: {
  days: string[];
  byDay: Map<string, CalItem[]>;
  today: string;
  itemHref: (i: CalItem) => string;
  className?: string;
  hideEmpty?: boolean;
}) {
  const shown = hideEmpty ? days.filter((d) => (byDay.get(d) ?? []).length) : days;
  return (
    <div className={`${a.panel} ${className ?? ""}`}>
      {shown.length === 0 && <p className={a.empty}>Nothing scheduled in these 30 days.</p>}
      <ol className={c.dayList}>
        {shown.map((d) => {
          const list = byDay.get(d) ?? [];
          return (
            <li key={d} className={c.dlDay}>
              <div className={`${c.dlDate} ${d === today ? c.isToday : ""}`}>
                <span className={c.dow}>{fmt(fromLocal(d, "12:00"), "EEE")}</span>
                <span className={c.dnum}>{fmt(fromLocal(d, "12:00"), "d")}</span>
              </div>
              <div className={c.dlItems}>
                {list.length === 0 ? (
                  <Link href={`/admin/bookings/new?date=${d}`} className={c.dlEmpty}>
                    Free · add booking
                  </Link>
                ) : (
                  list.map((i) => (
                    <Link key={`${i.kind}-${i.id}`} href={itemHref(i)} className={`${itemClass(i)} ${c.row}`}>
                      <span className={c.itTime}>{isAllDay(i) ? "All day" : fmtTimeRange(i.start, i.end)}</span>
                      <span className={c.itTitle}>{i.title}</span>
                      <span className={c.itSub}>{i.sub}</span>
                    </Link>
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MonthGrid({
  days,
  byDay,
  today,
  month,
  itemHref,
  dayHref,
}: {
  days: string[];
  byDay: Map<string, CalItem[]>;
  today: string;
  month: string;
  itemHref: (i: CalItem) => string;
  dayHref: (d: string) => string;
}) {
  return (
    <div className={`${a.panel} ${c.month}`}>
      {days.slice(0, 7).map((d) => (
        <span key={d} className={c.mHead}>
          {fmt(fromLocal(d, "12:00"), "EEE")}
        </span>
      ))}
      {days.map((d) => {
        const list = byDay.get(d) ?? [];
        const sessions = list.filter((i) => i.kind === "booking" || i.kind === "hold").length;
        return (
          <div key={d} className={`${c.mCell} ${d.slice(0, 7) !== month ? c.mOut : ""} ${d === today ? c.mToday : ""}`}>
            <Link href={dayHref(d)} className={c.mNum} aria-label={`${fmt(fromLocal(d, "12:00"), "EEEE MMMM d")}: ${list.length} items`}>
              {fmt(fromLocal(d, "12:00"), "d")}
            </Link>
            <div className={c.mItems}>
              {list.slice(0, 3).map((i) => (
                <Link key={`${i.kind}-${i.id}`} href={itemHref(i)} className={`${itemClass(i)} ${c.mItem}`}>
                  <span className={c.itTime}>{isAllDay(i) ? "" : fmtTime(i.start)}</span> {i.title}
                </Link>
              ))}
              {list.length > 3 && (
                <Link href={dayHref(d)} className={c.mMore}>
                  +{list.length - 3} more
                </Link>
              )}
            </div>
            {list.length > 0 && (
              <Link href={dayHref(d)} className={c.mDots} aria-hidden tabIndex={-1}>
                {sessions > 0 && <span className={c.mCount}>{sessions}</span>}
                {list.some((i) => i.kind === "block") && <span className={`${c.mDot} ${c.k_block}`} />}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
