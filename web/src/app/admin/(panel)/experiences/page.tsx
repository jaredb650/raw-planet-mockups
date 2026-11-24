import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addons, bookings, experiences } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { fmtDuration } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ExpName, Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import { createExperienceAction } from "./actions";
import a from "@/components/admin/admin.module.css";
import e from "@/components/admin/exp.module.css";

export const metadata = { title: "Experiences" };

export default async function ExperiencesPage() {
  await requireAdmin();
  const db = await getDb();
  const [rows, upcoming, addonRows] = await Promise.all([
    db.select().from(experiences).orderBy(asc(experiences.sortOrder), asc(experiences.name)),
    db
      .select({ id: bookings.experienceId, n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(sql`${bookings.status} = 'confirmed' and ${bookings.startAt} > now()`)
      .groupBy(bookings.experienceId),
    db.select({ id: addons.id, experienceId: addons.experienceId, active: addons.active }).from(addons),
  ]);
  const up = (id: string) => Number(upcoming.find((u) => u.id === id)?.n ?? 0);

  return (
    <div className={a.page}>
      <PageHeader title="Experiences" sub="What guests can book: copy, prices, session lengths, opening hours and rules." />

      <div className={e.cards}>
        {rows.map((x) => {
          const prices = x.durationOptions.map((o) => o.priceCents);
          const from = Math.min(...prices);
          const extras = addonRows.filter((ad) => ad.active && (ad.experienceId === x.id || ad.experienceId === null)).length;
          return (
            <Link key={x.id} href={`/admin/experiences/${x.id}`} className={`${a.panel} ${e.card}`}>
              {x.media[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.media[0].src} alt="" className={e.thumb} loading="lazy" />
              )}
              <div className={e.cardBody}>
                <div className={a.rowBetween}>
                  <ExpName theme={x.theme} name={x.name} />
                  {x.active ? <Pill tone="success">Live</Pill> : <Pill tone="neutral">Hidden</Pill>}
                </div>
                <p className={`${a.small} ${a.muted}`}>{x.tagline || x.summary.slice(0, 90)}</p>
                <dl className={e.facts}>
                  <div>
                    <dt>From</dt>
                    <dd>
                      {formatMoney(from)}
                      <span className={a.muted}> {x.pricingMode === "per_person" ? "/ person" : "/ session"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Lengths</dt>
                    <dd>{x.durationOptions.map((o) => fmtDuration(o.minutes).replace(" hours", "h").replace(" hour", "h").replace(" minutes", "m")).join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Guests</dt>
                    <dd>
                      {x.minGuests}–{x.maxGuests}
                    </dd>
                  </div>
                  <div>
                    <dt>Upcoming</dt>
                    <dd>{up(x.id)}</dd>
                  </div>
                </dl>
                <span className={`${a.small} ${a.muted}`}>
                  {extras ? `${extras} add-on${extras === 1 ? "" : "s"}` : "No add-ons"}
                  {x.isPlaceholder ? " · placeholder copy" : ""}
                  {!x.address || /exact address|confirmed with/i.test(x.address) ? " · address not set" : ""}
                </span>
              </div>
              <span className={e.edit}>
                Edit <Icon name="right" size={14} />
              </span>
            </Link>
          );
        })}
      </div>

      <Panel title="Add an experience" className={a.section}>
        <div className={a.panelBody}>
          <ActionForm action={createExperienceAction} className={a.row}>
            <label htmlFor="new-exp" className="sr-only">
              Name
            </label>
            <input id="new-exp" name="name" className={a.input} placeholder="e.g. Beat-making for kids" required style={{ maxWidth: 360, flex: "1 1 220px" }} />
            <SubmitButton pendingText="Creating…">Create (hidden)</SubmitButton>
          </ActionForm>
          <p className={a.hint} style={{ marginTop: 8 }}>
            It starts hidden so you can fill it in. Turn on “Live on website” when it’s ready.
          </p>
        </div>
      </Panel>
    </div>
  );
}
