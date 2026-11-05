import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { experiences, pricingRules, type PricingRule } from "@/lib/db/schema";
import { getSuggestions, HISTORY_DAYS, MIN_BOOKINGS, MIN_OPEN_WEEKS, weekGrid, type RulePrefill } from "@/lib/admin/pricing";
import { weekStartKey } from "@/lib/admin/dashboard";
import { addDaysKey, fmt, fmtDuration, fmtTime, fromLocal, todayKey, weekdayOf } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ActionForm";
import { Pill } from "@/components/admin/Pill";
import { plural } from "@/components/admin/format";
import { deleteRuleAction, saveRuleAction, toggleRuleAction } from "./actions";
import a from "@/components/admin/admin.module.css";
import s from "@/components/admin/insights.module.css";

export const metadata = { title: "Smart pricing" };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const clock = (t: string) => fmtTime(fromLocal("2026-01-05", t));
const day = (k: string) => fmt(fromLocal(k, "12:00"), "MMM d, yyyy");
const signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}%`;

function state(r: PricingRule, today: string): { label: string; tone: "success" | "neutral" | "warning" } {
  if (!r.active) return { label: "Off", tone: "neutral" };
  if (r.dateTo && r.dateTo < today) return { label: "Ended", tone: "neutral" };
  if (r.dateFrom && r.dateFrom > today) return { label: "Scheduled", tone: "warning" };
  return { label: "Live", tone: "success" };
}

function describe(r: PricingRule, expName: (id: string) => string): string {
  const parts: string[] = [];
  parts.push(r.experienceIds?.length ? r.experienceIds.map(expName).join(", ") : "All experiences");
  if (r.weekdays?.length) parts.push(DAY_ORDER.filter((d) => r.weekdays!.includes(d)).map((d) => DAY_NAMES[d]).join(", "));
  if (r.startTime && r.endTime) parts.push(`starting ${clock(r.startTime)} to ${clock(r.endTime)}`);
  else if (r.startTime) parts.push(`starting from ${clock(r.startTime)}`);
  else if (r.endTime) parts.push(`starting before ${clock(r.endTime)}`);
  if (r.dateFrom && r.dateTo) parts.push(`${day(r.dateFrom)} to ${day(r.dateTo)}`);
  else if (r.dateFrom) parts.push(`from ${day(r.dateFrom)}`);
  else if (r.dateTo) parts.push(`until ${day(r.dateTo)}`);
  if (r.minHoursAhead != null) parts.push(`booked at least ${plural(r.minHoursAhead, "hour")} ahead`);
  if (r.maxHoursAhead != null) parts.push(`booked at most ${plural(r.maxHoursAhead, "hour")} ahead`);
  return parts.join(" · ");
}

function prefillHref(p: RulePrefill) {
  const q = new URLSearchParams({ pName: p.name, pExp: p.experienceIds.join(","), pDay: String(p.weekday), pStart: p.startTime, pEnd: p.endTime, pPct: String(p.adjustPercent) });
  return `/admin/pricing?${q}#rule-form`;
}

type Sp = Record<string, string | string[] | undefined>;

export default async function PricingPage({ searchParams }: { searchParams: Promise<Sp> }) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();
  const today = todayKey(now);
  const db = await getDb();
  const [rules, exps, suggestions] = await Promise.all([
    db.select().from(pricingRules).orderBy(desc(pricingRules.active), desc(pricingRules.priority), asc(pricingRules.name)),
    db.select().from(experiences).orderBy(asc(experiences.sortOrder)),
    getSuggestions(now),
  ]);
  const expOptions = exps.map((e) => ({ id: e.id, name: e.shortName }));
  const expName = (id: string) => expOptions.find((e) => e.id === id)?.name ?? "removed";

  const live = exps.filter((e) => e.active);
  const exp = live.find((e) => e.id === one(sp.exp)) ?? live[0];
  const durations = exp ? [...exp.durationOptions].sort((x, y) => x.minutes - y.minutes) : [];
  const duration = durations.find((d) => d.minutes === Number(one(sp.dur)))?.minutes ?? durations[0]?.minutes;
  const weekParam = one(sp.week);
  const week = weekStartKey(weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : addDaysKey(today, 7));
  const grid = exp && duration ? weekGrid(exp, rules, week, duration, now) : null;
  const gridHref = (o: { exp?: string; dur?: number; week?: string }) =>
    `/admin/pricing?${new URLSearchParams({ exp: o.exp ?? exp!.id, dur: String(o.dur ?? duration), week: o.week ?? week })}#guests-pay`;

  const pct = Number(one(sp.pPct));
  const prefill: Partial<PricingRule> | null = one(sp.pName)
    ? {
        name: one(sp.pName),
        adjustPercent: Number.isInteger(pct) ? pct : undefined,
        experienceIds: one(sp.pExp)?.split(",").filter(Boolean) ?? null,
        weekdays: one(sp.pDay) ? [Number(one(sp.pDay))] : null,
        startTime: one(sp.pStart) ?? null,
        endTime: one(sp.pEnd) ?? null,
      }
    : null;

  return (
    <div className={a.page}>
      <PageHeader title="Smart pricing" sub="Charge a little more for the times that always fill and a little less for the quiet ones. Guests see the real price on every time before they pick it." />

      <div className={a.split}>
        <div className={a.stack}>
          <Panel title="Your rules" count={rules.length || undefined}>
            {rules.length === 0 ? (
              <Empty>No rules yet, so every time is at the normal price.</Empty>
            ) : (
              <ul className={a.list}>
                {rules.map((r) => {
                  const st = state(r, today);
                  return (
                    <li key={r.id}>
                      <div className={a.row} style={{ gap: 8 }}>
                        <span className={a.listTitle}>{r.name}</span>
                        <strong className={a.num}>{signed(r.adjustPercent)}</strong>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </div>
                      <div className={a.listMeta}>
                        {describe(r, expName)}
                        {r.priority ? ` · priority ${r.priority}` : ""}
                      </div>
                      <details style={{ marginTop: 6 }}>
                        <summary className={`${a.small} ${a.muted}`} style={{ cursor: "pointer" }}>
                          Edit
                        </summary>
                        <div style={{ paddingTop: 12, display: "grid", gap: 12 }}>
                          <RuleForm rule={r} exps={expOptions} />
                          <div className={a.row}>
                            <ActionForm action={toggleRuleAction} className={a.row} hideMessage>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="active" value={r.active ? "false" : "true"} />
                              <SubmitButton className={`${a.btn} ${a.btnSm}`}>{r.active ? "Turn off" : "Turn on"}</SubmitButton>
                            </ActionForm>
                            <ActionForm action={deleteRuleAction} className={a.row}>
                              <input type="hidden" name="id" value={r.id} />
                              <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Delete rule">
                                Delete
                              </ConfirmSubmit>
                            </ActionForm>
                          </div>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="What guests will pay" id="guests-pay">
            <div className={a.panelBody}>
              {!grid || !exp ? (
                <p className={a.muted}>Turn on an experience to see its prices.</p>
              ) : (
                <>
                  <nav className={a.tabs} aria-label="Experience">
                    {live.map((e) => (
                      <Link key={e.id} href={gridHref({ exp: e.id, dur: e.durationOptions[0]?.minutes })} className={`${a.tab} ${e.id === exp.id ? a.tabActive : ""}`} aria-current={e.id === exp.id ? "true" : undefined}>
                        {e.shortName}
                      </Link>
                    ))}
                  </nav>
                  <div className={s.subTabs}>
                    {durations.length > 1 &&
                      durations.map((d) => (
                        <Link key={d.minutes} href={gridHref({ dur: d.minutes })} className={`${a.btn} ${a.btnSm} ${d.minutes === duration ? a.btnPrimary : ""}`} aria-current={d.minutes === duration ? "true" : undefined}>
                          {fmtDuration(d.minutes)}
                        </Link>
                      ))}
                    <Link href={gridHref({ week: addDaysKey(week, -7) })} className={`${a.btn} ${a.btnSm}`}>
                      Earlier week
                    </Link>
                    <Link href={gridHref({ week: addDaysKey(week, 7) })} className={`${a.btn} ${a.btnSm}`}>
                      Later week
                    </Link>
                  </div>
                  <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Prices by weekday and start time">
                    <table className={s.grid}>
                      <caption>
                        Week of {fmt(fromLocal(week, "12:00"), "MMM d")}, {exp.pricingMode === "per_session" ? "per session before extra guests" : "per guest"}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">
                            <span className="sr-only">Start time</span>
                          </th>
                          {grid.dates.map((d) => (
                            <th key={d} scope="col">
                              {DAY_NAMES[weekdayOf(d)]}
                              <small>{fmt(fromLocal(d, "12:00"), "MMM d")}</small>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grid.times.map((t) => (
                          <tr key={t}>
                            <th scope="row">{clock(t)}</th>
                            {grid.dates.map((d) => {
                              const c = grid.cells[`${d}|${t}`];
                              if (!c) return <td key={d} className={s.closed}><span aria-hidden>–</span><span className="sr-only">Closed</span></td>;
                              return (
                                <td key={d} className={c.adjustPercent > 0 ? s.up : c.adjustPercent < 0 ? s.down : undefined}>
                                  {formatMoney(c.cents)}
                                  {c.adjustPercent ? <small>{signed(c.adjustPercent)}</small> : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className={`${a.hint}`} style={{ marginTop: 10 }}>
                    This is what someone booking right now would pay. A plain price is your normal price. Rules that depend on how far ahead someone books can change these as the date gets closer.
                  </p>
                </>
              )}
            </div>
          </Panel>
        </div>

        <div className={a.stack}>
          <Panel title="Suggestions" count={suggestions.items.length || undefined}>
            {!suggestions.enoughData ? (
              <Empty>
                Not enough history yet. There {suggestions.bookings === 1 ? "is 1 session" : `are ${suggestions.bookings} sessions`} in the last {HISTORY_DAYS} days, and suggestions start at {MIN_BOOKINGS}, because a guess from a handful of bookings would be just that.
              </Empty>
            ) : suggestions.items.length === 0 ? (
              <Empty>
                Nothing stands out yet across {plural(suggestions.bookings, "session")} over {plural(suggestions.days, "day")}. A time needs {MIN_OPEN_WEEKS} open weeks behind it and has to be almost always empty or almost always full. Times a rule already covers are skipped.
              </Empty>
            ) : (
              <ul className={a.list}>
                {suggestions.items.map((i) => (
                  <li key={i.prefill.name}>
                    <div className={a.listTitle}>{i.title}</div>
                    <div className={a.listMeta}>{i.evidence}</div>
                    <div className={a.row} style={{ marginTop: 8 }}>
                      <Link href={prefillHref(i.prefill)} className={`${a.btn} ${a.btnSm}`}>
                        Try {signed(i.prefill.adjustPercent)}
                      </Link>
                      <span className={`${a.small} ${a.muted}`}>Fills in the form. Nothing goes live.</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={prefill ? "New rule from a suggestion" : "New rule"} id="rule-form">
            <div className={a.panelBody}>
              {prefill && (
                <p className={`${a.notice} ${a.noticeWarn}`} style={{ marginBottom: 12 }}>
                  Check the details. This rule stays off until you tick Active and save.
                </p>
              )}
              <RuleForm key={JSON.stringify(prefill)} rule={prefill} isNew exps={expOptions} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function RuleForm({ rule, exps, isNew }: { rule?: Partial<PricingRule> | null; exps: { id: string; name: string }[]; isNew?: boolean }) {
  const k = isNew ? "new" : rule?.id;
  // A suggestion never goes live by itself: its Active box starts empty.
  const active = isNew ? !rule : rule?.active;
  return (
    <ActionForm action={saveRuleAction} resetOnSuccess={isNew}>
      {!isNew && <input type="hidden" name="id" value={rule?.id} />}
      <div className={a.field}>
        <label htmlFor={`pr-name-${k}`}>Name (only you see it)</label>
        <input id={`pr-name-${k}`} name="name" className={a.input} defaultValue={rule?.name} placeholder="Saturday evenings" required maxLength={80} />
      </div>
      <div className={a.field}>
        <label htmlFor={`pr-pct-${k}`}>Price change (%)</label>
        <input id={`pr-pct-${k}`} name="percent" className={a.input} defaultValue={rule?.adjustPercent} inputMode="text" placeholder="15 or -20" required aria-describedby={`pr-pct-h-${k}`} />
        <span id={`pr-pct-h-${k}`} className={a.hint}>
          Between -50 and 50. Use a minus for a discount. The session price is rounded to whole dollars.
        </span>
      </div>
      <fieldset className={a.fieldset}>
        <legend className={a.label} style={{ fontSize: 13.5 }}>
          Days <span className={a.muted} style={{ fontWeight: 400 }}>(none ticked = every day)</span>
        </legend>
        <div className={s.days}>
          {DAY_ORDER.map((d) => (
            <label key={d} className={a.check}>
              <input type="checkbox" name="weekdays" value={d} defaultChecked={rule?.weekdays?.includes(d)} />
              <span>{DAY_NAMES[d]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={`pr-st-${k}`}>Sessions starting from</label>
          <input id={`pr-st-${k}`} name="startTime" type="time" className={a.input} defaultValue={rule?.startTime ?? ""} />
        </div>
        <div className={a.field}>
          <label htmlFor={`pr-et-${k}`}>and before</label>
          <input id={`pr-et-${k}`} name="endTime" type="time" className={a.input} defaultValue={rule?.endTime ?? ""} />
        </div>
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={`pr-df-${k}`}>First date</label>
          <input id={`pr-df-${k}`} name="dateFrom" type="date" className={a.input} defaultValue={rule?.dateFrom ?? ""} />
        </div>
        <div className={a.field}>
          <label htmlFor={`pr-dt-${k}`}>Last date</label>
          <input id={`pr-dt-${k}`} name="dateTo" type="date" className={a.input} defaultValue={rule?.dateTo ?? ""} />
        </div>
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={`pr-min-${k}`}>At least (hours ahead)</label>
          <input id={`pr-min-${k}`} name="minHoursAhead" inputMode="numeric" className={a.input} defaultValue={rule?.minHoursAhead ?? ""} placeholder="Any" />
        </div>
        <div className={a.field}>
          <label htmlFor={`pr-max-${k}`}>At most (hours ahead)</label>
          <input id={`pr-max-${k}`} name="maxHoursAhead" inputMode="numeric" className={a.input} defaultValue={rule?.maxHoursAhead ?? ""} placeholder="Any" />
        </div>
      </div>
      <fieldset className={a.fieldset}>
        <legend className={a.label} style={{ fontSize: 13.5 }}>
          Works on <span className={a.muted} style={{ fontWeight: 400 }}>(none ticked = everything)</span>
        </legend>
        {exps.map((e) => (
          <label key={e.id} className={a.check}>
            <input type="checkbox" name="experienceIds" value={e.id} defaultChecked={rule?.experienceIds?.includes(e.id)} />
            <span>{e.name}</span>
          </label>
        ))}
      </fieldset>
      <div className={a.field}>
        <label htmlFor={`pr-pri-${k}`}>Priority</label>
        <input id={`pr-pri-${k}`} name="priority" inputMode="numeric" className={a.input} defaultValue={rule?.priority ?? 0} aria-describedby={`pr-pri-h-${k}`} />
        <span id={`pr-pri-h-${k}`} className={a.hint}>
          Rules never add up. If two match a session, the higher number wins.
        </span>
      </div>
      <label className={a.check}>
        <input type="checkbox" name="active" defaultChecked={active} />
        <span>Active</span>
      </label>
      <div className={a.formFoot}>
        <SubmitButton className={`${a.btn} ${isNew ? a.btnPrimary : ""}`} pendingText="Saving…">
          {isNew ? "Create rule" : "Save"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
