import Link from "next/link";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { blocks, calendarFeeds, experiences, type WeeklySchedule } from "@/lib/db/schema";
import { getCalendarFeedUrl } from "@/lib/calendar-feed";
import { integrations } from "@/lib/config";
import { fmt, fmtTimeRange, localDateKey, todayKey } from "@/lib/time";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { BlockForm } from "@/components/admin/BlockForm";
import { FeedLink } from "@/components/admin/FeedLink";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ActionForm";
import { ExpName, Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import { plural } from "@/components/admin/format";
import {
  addFeedAction,
  createBlockAction,
  deleteBlockAction,
  deleteFeedAction,
  regenerateFeedLinkAction,
  syncFeedsAction,
  toggleFeedAction,
} from "./actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Availability" };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0];
const hm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const hr = h % 12 || 12;
  return `${hr}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 || h === 24 ? "am" : "pm"}`;
};
/** Consecutive days with the same hours collapse into one row ("Mon–Fri"). */
function hoursSummary(s: WeeklySchedule) {
  const rows: { day: string; windows: string }[] = [];
  let first = "";
  DAY_IDX.forEach((d, i) => {
    const windows = (s[String(d)] ?? []).map((w) => `${hm(w.start)}–${hm(w.end)}`).join(", ");
    const last = rows[rows.length - 1];
    if (last && last.windows === windows) last.day = `${first}–${DAYS[i]}`;
    else {
      first = DAYS[i];
      rows.push({ day: DAYS[i], windows });
    }
  });
  return rows;
}

export default async function AvailabilityPage() {
  await requireAdmin();
  const db = await getDb();
  const now = new Date();
  const [exps, upcoming, feeds, feedCounts, feedUrl] = await Promise.all([
    db.select().from(experiences).orderBy(asc(experiences.sortOrder)),
    db
      .select({ id: blocks.id, startAt: blocks.startAt, endAt: blocks.endAt, reason: blocks.reason, exp: experiences.shortName })
      .from(blocks)
      .leftJoin(experiences, eq(experiences.id, blocks.experienceId))
      .where(and(eq(blocks.source, "manual"), gt(blocks.endAt, now)))
      .orderBy(asc(blocks.startAt))
      .limit(200),
    db.select().from(calendarFeeds).orderBy(desc(calendarFeeds.createdAt)),
    db
      .select({ feedId: blocks.feedId, n: sql<number>`count(*)::int` })
      .from(blocks)
      .where(gt(blocks.endAt, now))
      .groupBy(blocks.feedId),
    getCalendarFeedUrl().catch(() => null),
  ]);
  // Manual blocks are stored once per resource group; show each time once.
  const seen = new Set<string>();
  const manual = upcoming.filter((b) => {
    const k = `${b.startAt.toISOString()}|${b.endAt.toISOString()}|${b.reason}|${b.exp ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const countFor = (id: string) => Number(feedCounts.find((c) => c.feedId === id)?.n ?? 0);
  const calcom = integrations.calcom();

  return (
    <div className={a.page}>
      <PageHeader
        title="Availability"
        sub="When guests can book: your opening hours, time you block off, and other calendars that keep the website from double-booking."
        actions={
          <Link href="/admin/calendar" className={a.btn}>
            <Icon name="calendar" size={16} /> Open calendar
          </Link>
        }
      />

      <div className={a.split}>
        <div className={a.stack}>
          <Panel title="Block time off" id="block">
            <div className={a.panelBody}>
              <BlockForm action={createBlockAction} experiences={exps.map((e) => ({ id: e.id, name: e.shortName }))} defaultDate={todayKey(now)} />
            </div>
          </Panel>

          <Panel title="Upcoming blocks" count={manual.length || undefined}>
            {manual.length === 0 ? (
              <Empty>Nothing blocked. Every opening hour is bookable.</Empty>
            ) : (
              <ul className={a.list}>
                {manual.map((b) => {
                  const multi = localDateKey(b.startAt) !== localDateKey(new Date(b.endAt.getTime() - 1));
                  const allDay = b.endAt.getTime() - b.startAt.getTime() >= 20 * 3600_000;
                  return (
                    <li key={b.id} className={a.listRow}>
                      <div className={a.listMain}>
                        <div className={a.listTitle}>
                          {fmt(b.startAt, "EEE MMM d")}
                          {multi && ` – ${fmt(new Date(b.endAt.getTime() - 1), "EEE MMM d")}`}
                        </div>
                        <div className={a.listMeta}>
                          {allDay ? "All day" : fmtTimeRange(b.startAt, b.endAt)}
                          {b.exp ? ` · only ${b.exp}` : ""}
                          {b.reason ? ` · ${b.reason}` : ""}
                        </div>
                      </div>
                      <ActionForm action={deleteBlockAction} className={a.row} hideMessage>
                        <input type="hidden" name="id" value={b.id} />
                        <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Remove">
                          Remove
                        </ConfirmSubmit>
                      </ActionForm>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Calendars you import"
            id="feeds"
            action={
              feeds.length > 0 ? (
                <ActionForm action={syncFeedsAction} className={a.row} hideMessage>
                  <SubmitButton className={`${a.btn} ${a.btnSm}`} pendingText="Syncing…">
                    Sync all now
                  </SubmitButton>
                </ActionForm>
              ) : undefined
            }
          >
            <div className={a.panelBody} style={{ borderBottom: "1px solid var(--a-line)" }}>
              <p className={a.hint}>
                Busy times in these calendars block the website. Paste an iCal (.ics) link: Airbnb (Calendar → Availability → Connect calendars → Export), Google Calendar
                (Settings → your calendar → Secret address in iCal format) or any other. They re-sync automatically every few minutes.
              </p>
            </div>
            {feeds.length === 0 ? (
              <Empty>No calendars connected yet.</Empty>
            ) : (
              <ul className={a.list}>
                {feeds.map((f) => (
                  <li key={f.id}>
                    <div className={a.listRow}>
                      <div className={a.listMain}>
                        <div className={a.listTitle}>
                          {f.name}{" "}
                          {!f.active ? <Pill tone="neutral">Paused</Pill> : f.lastError ? <Pill tone="danger">Failing</Pill> : f.lastSyncedAt ? <Pill tone="success">Syncing</Pill> : <Pill tone="warning">Not synced yet</Pill>}
                        </div>
                        <div className={`${a.listMeta} ${a.mono}`} style={{ fontSize: 12.5 }}>
                          {f.url.replace(/^https?:\/\//, "").slice(0, 70)}
                          {f.url.length > 78 ? "…" : ""}
                        </div>
                        <div className={a.listMeta}>
                          {f.active ? `${plural(countFor(f.id), "busy time")} ahead` : "Not blocking anything"}
                          {f.lastSyncedAt ? ` · last synced ${fmt(f.lastSyncedAt, "MMM d, h:mmaaa")}` : ""}
                        </div>
                        {f.lastError && f.active && <p className={`${a.small} ${a.msgErr}`}>{f.lastError}</p>}
                      </div>
                    </div>
                    <div className={a.row} style={{ marginTop: 8, gap: 6 }}>
                      {f.active && (
                        <ActionForm action={syncFeedsAction} className={a.row} hideMessage>
                          <input type="hidden" name="id" value={f.id} />
                          <SubmitButton className={`${a.btn} ${a.btnSm}`} pendingText="Syncing…">
                            Sync now
                          </SubmitButton>
                        </ActionForm>
                      )}
                      <ActionForm action={toggleFeedAction} className={a.row} hideMessage>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="active" value={f.active ? "false" : "true"} />
                        <SubmitButton className={`${a.btn} ${a.btnSm}`}>{f.active ? "Pause" : "Turn on"}</SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteFeedAction} className={a.row} hideMessage>
                        <input type="hidden" name="id" value={f.id} />
                        <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Remove feed">
                          Remove
                        </ConfirmSubmit>
                      </ActionForm>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <details className={a.disclosure}>
              <summary>Add a calendar</summary>
              <div className={a.disclosureBody}>
                <ActionForm action={addFeedAction} resetOnSuccess>
                  <div className={a.formRow}>
                    <div className={a.field}>
                      <label htmlFor="feed-name">Name</label>
                      <input id="feed-name" name="name" className={a.input} placeholder="Airbnb, Personal Google…" required maxLength={80} />
                    </div>
                    <div className={a.field}>
                      <label htmlFor="feed-link">iCal link</label>
                      <input id="feed-link" name="url" className={a.input} placeholder="https://… or webcal://…" required inputMode="url" autoComplete="off" />
                    </div>
                  </div>
                  <div className={a.formFoot}>
                    <SubmitButton pendingText="Checking link…">Connect</SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </details>
          </Panel>
        </div>

        <div className={a.stack}>
          <Panel title="How double-booking is prevented">
            <div className={a.panelBody}>
              <ul className={a.list} style={{ margin: "-12px -18px" }}>
                <li>
                  <div className={a.listTitle}>Website</div>
                  <p className={a.listMeta}>Every booking, checkout hold and block here is checked before a guest can pay.</p>
                </li>
                <li>
                  <div className={a.listTitle}>Google Calendar {calcom ? <Pill tone="success">via Cal.com</Pill> : <Pill tone="warning">Cal.com not connected</Pill>}</div>
                  <p className={a.listMeta}>
                    {calcom
                      ? "Cal.com checks your Google Calendar on every booking and adds website bookings to it."
                      : "Until Cal.com is connected, import your Google Calendar above and subscribe to the export link below."}
                  </p>
                </li>
                <li>
                  <div className={a.listTitle}>Airbnb</div>
                  <p className={a.listMeta}>Airbnb syncs both ways with Google Calendar. Importing its iCal link above is an extra safety net.</p>
                </li>
                <li>
                  <div className={a.listTitle}>Viator</div>
                  <p className={a.listMeta}>
                    Viator has no calendar sync. When a Viator booking comes in, <Link href="/admin/bookings/new?source=viator">add it here</Link> or block the time.
                  </p>
                </li>
              </ul>
            </div>
          </Panel>

          {feedUrl && (
            <Panel title="See bookings in your own calendar">
              <div className={a.panelBody}>
                <p className={a.hint} style={{ marginBottom: 12 }}>
                  Every confirmed session from every source, plus community events, as a live calendar you can subscribe to on your phone.
                </p>
                <FeedLink initialUrl={feedUrl} regenerate={regenerateFeedLinkAction} />
              </div>
            </Panel>
          )}

          <Panel title="Opening hours" action={<Link className={a.panelLink} href="/admin/experiences">Edit</Link>}>
            <ul className={a.list}>
              {exps
                .filter((e) => e.active)
                .map((e) => (
                  <li key={e.id}>
                    <div className={a.listTitle} style={{ marginBottom: 4 }}>
                      <ExpName theme={e.theme} name={e.shortName} />
                    </div>
                    <table className={a.small} style={{ borderCollapse: "collapse", width: "100%" }}>
                      <tbody>
                        {hoursSummary(e.schedule).map((r) => (
                          <tr key={r.day}>
                            <td style={{ width: 76, color: "var(--ink-soft)", padding: "1px 0" }}>{r.day}</td>
                            <td style={{ padding: "1px 0" }}>{r.windows || <span className={a.dash}>Closed</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className={`${a.small} ${a.muted}`} style={{ marginTop: 4 }}>
                      Starts every {e.slotStepMinutes} min · {e.leadTimeHours}h notice · {e.bufferMinutes ? `${e.bufferMinutes} min buffer · ` : ""}books up to {e.maxAdvanceDays} days ahead
                    </p>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
