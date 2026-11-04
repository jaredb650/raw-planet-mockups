import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bookings, experiences, reviews } from "@/lib/db/schema";
import { fmt, todayKey } from "@/lib/time";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ActionForm";
import { ExpName, Pill } from "@/components/admin/Pill";
import { addReviewAction, deleteReviewAction, featureReviewAction, replyReviewAction, setReviewStatusAction, videoReviewAction } from "./actions";
import a from "@/components/admin/admin.module.css";
import r from "@/components/admin/reviews.module.css";

export const metadata = { title: "Reviews" };

const TABS = [
  { v: "pending", label: "Waiting" },
  { v: "published", label: "On website" },
  { v: "hidden", label: "Hidden" },
  { v: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["v"];
const SOURCE: Record<string, string> = { airbnb: "Airbnb", google: "Google", viator: "Viator", direct: "Website" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Stars({ n }: { n: number }) {
  return (
    <span className={r.stars} role="img" aria-label={`${n} out of 5 stars`}>
      {"★★★★★".slice(0, n)}
      <span className={r.off}>{"★★★★★".slice(n)}</span>
    </span>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = await getDb();
  const [counts] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${reviews.status} = 'pending')::int`,
      published: sql<number>`count(*) filter (where ${reviews.status} = 'published')::int`,
      hidden: sql<number>`count(*) filter (where ${reviews.status} = 'hidden')::int`,
      all: sql<number>`count(*)::int`,
      avg: sql<number | null>`avg(${reviews.rating}) filter (where ${reviews.status} = 'published')::float`,
    })
    .from(reviews);
  const requested = one(sp.status) as Tab;
  const tab: Tab = TABS.some((t) => t.v === requested) ? requested : Number(counts?.pending ?? 0) > 0 ? "pending" : "published";
  const [rows, exps] = await Promise.all([
    db
      .select({ rv: reviews, exp: experiences.shortName, theme: experiences.theme, code: bookings.code })
      .from(reviews)
      .leftJoin(experiences, eq(experiences.id, reviews.experienceId))
      .leftJoin(bookings, eq(bookings.id, reviews.bookingId))
      .where(tab === "all" ? undefined : eq(reviews.status, tab))
      .orderBy(desc(reviews.featured), desc(sql`coalesce(${reviews.reviewDate}, ${reviews.createdAt})`))
      .limit(200),
    db.select({ id: experiences.id, name: experiences.shortName }).from(experiences).orderBy(asc(experiences.sortOrder)),
  ]);

  return (
    <div className={a.page}>
      <PageHeader
        title="Reviews"
        sub={
          counts?.avg
            ? `${Number(counts.published)} on the website, averaging ${Number(counts.avg).toFixed(2)}★. Guests are asked for one after their session.`
            : "Guests are asked for a review after their session."
        }
      />
      <nav className={a.tabs} aria-label="Review status">
        {TABS.map((t) => (
          <Link key={t.v} href={`/admin/reviews?status=${t.v}`} className={`${a.tab} ${tab === t.v ? a.tabActive : ""}`} aria-current={tab === t.v ? "page" : undefined}>
            {t.label}
            <span className={a.tabCount}>{Number(counts?.[t.v] ?? 0)}</span>
          </Link>
        ))}
      </nav>

      <div className={a.split}>
        <div className={a.stack}>
          {rows.length === 0 ? (
            <Panel>
              <Empty>{tab === "pending" ? "No reviews waiting. New ones from guests land here first." : "Nothing here."}</Empty>
            </Panel>
          ) : (
            rows.map(({ rv, exp, theme, code }) => (
              <article key={rv.id} className={`${a.panel} ${r.card} ${rv.featured ? r.featured : ""}`}>
                <header className={r.head}>
                  <div>
                    <div className={r.who}>
                      {rv.name}
                      {rv.location && <span className={a.muted}> · {rv.location}</span>}
                    </div>
                    <div className={a.listMeta}>
                      <Stars n={rv.rating} /> · {SOURCE[rv.source] ?? rv.source} · {fmt(rv.reviewDate ?? rv.createdAt, "MMM d, yyyy")}
                      {exp && theme && (
                        <>
                          {" · "}
                          <ExpName theme={theme} name={exp} />
                        </>
                      )}
                      {code && rv.bookingId && (
                        <>
                          {" · "}
                          <Link href={`/admin/bookings/${rv.bookingId}`} className={a.code}>
                            {code}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={a.row} style={{ gap: 4 }}>
                    {rv.featured && <Pill tone="accent">Featured</Pill>}
                    {tab === "all" && <Pill tone={rv.status === "published" ? "success" : rv.status === "pending" ? "warning" : "neutral"}>{rv.status === "published" ? "On website" : rv.status === "pending" ? "Waiting" : "Hidden"}</Pill>}
                  </span>
                </header>
                <p className={r.body}>{rv.body}</p>
                {rv.hostReply && (
                  <p className={r.reply}>
                    <strong>Your reply:</strong> {rv.hostReply}
                  </p>
                )}
                <div className={r.actions}>
                  <ActionForm action={setReviewStatusAction} className={a.row} hideMessage>
                    <input type="hidden" name="id" value={rv.id} />
                    {rv.status !== "published" && (
                      <SubmitButton name="status" value="published" className={`${a.btn} ${a.btnSm} ${a.btnPrimary}`}>
                        Publish
                      </SubmitButton>
                    )}
                    {rv.status !== "hidden" && (
                      <SubmitButton name="status" value="hidden" className={`${a.btn} ${a.btnSm}`}>
                        Hide
                      </SubmitButton>
                    )}
                  </ActionForm>
                  {rv.status === "published" && (
                    <ActionForm action={featureReviewAction} className={a.row} hideMessage>
                      <input type="hidden" name="id" value={rv.id} />
                      <input type="hidden" name="featured" value={rv.featured ? "false" : "true"} />
                      <SubmitButton className={`${a.btn} ${a.btnSm}`}>{rv.featured ? "Unfeature" : "Feature"}</SubmitButton>
                    </ActionForm>
                  )}
                  <details className={r.more}>
                    <summary className={`${a.btn} ${a.btnSm} ${a.btnGhost}`}>{rv.hostReply ? "Edit reply" : "Reply"}</summary>
                    <ActionForm action={replyReviewAction} className={r.replyForm}>
                      <input type="hidden" name="id" value={rv.id} />
                      <label htmlFor={`rep-${rv.id}`} className="sr-only">
                        Public reply
                      </label>
                      <textarea id={`rep-${rv.id}`} name="reply" className={a.textarea} defaultValue={rv.hostReply ?? ""} rows={3} placeholder="Thanks so much, it was a blast…" />
                      <div>
                        <SubmitButton className={`${a.btn} ${a.btnSm}`} pendingText="Saving…">
                          Save reply
                        </SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                  <details className={r.more}>
                    <summary className={`${a.btn} ${a.btnSm} ${a.btnGhost}`}>{rv.videoUrl ? "Edit video" : "Add video"}</summary>
                    <ActionForm action={videoReviewAction} className={r.replyForm}>
                      <input type="hidden" name="id" value={rv.id} />
                      <label htmlFor={`vid-${rv.id}`}>Video testimonial link</label>
                      <input id={`vid-${rv.id}`} name="videoUrl" type="text" inputMode="url" autoComplete="off" className={a.input} defaultValue={rv.videoUrl ?? ""} placeholder="https://youtu.be/… or a .mp4 link" />
                      <p className={a.hint}>Shows on the Reviews page. Leave empty and save to remove it.</p>
                      <div>
                        <SubmitButton className={`${a.btn} ${a.btnSm}`} pendingText="Saving…">
                          Save video
                        </SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                  <ActionForm action={deleteReviewAction} className={a.row} hideMessage>
                    <input type="hidden" name="id" value={rv.id} />
                    <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Delete">
                      Delete
                    </ConfirmSubmit>
                  </ActionForm>
                </div>
              </article>
            ))
          )}
        </div>

        <Panel title="Add a review from elsewhere">
          <div className={a.panelBody}>
            <ActionForm action={addReviewAction} resetOnSuccess>
              <p className={a.hint}>Copy a review in from Airbnb, Google or Viator so it shows on the website.</p>
              <div className={a.formRow}>
                <div className={a.field}>
                  <label htmlFor="rv-name">Name</label>
                  <input id="rv-name" name="name" className={a.input} required />
                </div>
                <div className={a.field}>
                  <label htmlFor="rv-loc">From (optional)</label>
                  <input id="rv-loc" name="location" className={a.input} placeholder="Brooklyn, NY" />
                </div>
              </div>
              <div className={a.formRow}>
                <div className={a.field}>
                  <label htmlFor="rv-src">Where</label>
                  <select id="rv-src" name="source" className={a.select} defaultValue="airbnb">
                    <option value="airbnb">Airbnb</option>
                    <option value="google">Google</option>
                    <option value="viator">Viator</option>
                    <option value="direct">Direct / email</option>
                  </select>
                </div>
                <div className={a.field}>
                  <label htmlFor="rv-rating">Stars</label>
                  <select id="rv-rating" name="rating" className={a.select} defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} ★
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={a.formRow}>
                <div className={a.field}>
                  <label htmlFor="rv-exp">Experience</label>
                  <select id="rv-exp" name="experienceId" className={a.select} defaultValue="">
                    <option value="">General</option>
                    {exps.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={a.field}>
                  <label htmlFor="rv-date">Date</label>
                  <input id="rv-date" name="reviewDate" type="date" className={a.input} defaultValue={todayKey()} />
                </div>
              </div>
              <div className={a.field}>
                <label htmlFor="rv-body">Review</label>
                <textarea id="rv-body" name="body" className={a.textarea} rows={5} required />
              </div>
              <div className={a.field}>
                <label htmlFor="rv-video">Video testimonial (optional)</label>
                <input id="rv-video" name="videoUrl" type="text" inputMode="url" autoComplete="off" className={a.input} placeholder="https://youtu.be/… or a .mp4 link" />
              </div>
              <label className={a.check}>
                <input type="checkbox" name="publish" defaultChecked />
                <span>Publish straight away</span>
              </label>
              <div className={a.formFoot}>
                <SubmitButton pendingText="Adding…">Add review</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </Panel>
      </div>
    </div>
  );
}
