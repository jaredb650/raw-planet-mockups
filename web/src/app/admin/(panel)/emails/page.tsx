import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";
import { integrations } from "@/lib/config";
import { fmt } from "@/lib/time";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Emails" };

const STATUSES = [
  { v: "", label: "All" },
  { v: "failed", label: "Failed" },
  { v: "sent", label: "Sent" },
  { v: "logged", label: "Not sent (test mode)" },
] as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const nice = (t: string) => t.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function EmailsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s.v === one(sp.status))?.v ?? "";
  const q = one(sp.q).trim().slice(0, 80);
  const open = one(sp.open);
  const db = await getDb();
  const where: SQL[] = [];
  if (status) where.push(eq(emailLog.status, status));
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(emailLog.to, like), ilike(emailLog.subject, like), ilike(emailLog.template, like))!);
  }
  const [rows, [counts]] = await Promise.all([
    db
      .select({ id: emailLog.id, to: emailLog.to, subject: emailLog.subject, template: emailLog.template, status: emailLog.status, error: emailLog.error, bookingId: emailLog.bookingId, createdAt: emailLog.createdAt })
      .from(emailLog)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(emailLog.createdAt))
      .limit(150),
    db
      .select({
        failed: sql<number>`count(*) filter (where ${emailLog.status} = 'failed' and ${emailLog.createdAt} > now() - interval '7 days')::int`,
        week: sql<number>`count(*) filter (where ${emailLog.createdAt} > now() - interval '7 days')::int`,
      })
      .from(emailLog),
  ]);
  const selected = open ? rows.find((r) => r.id === open) ?? (await db.select().from(emailLog).where(eq(emailLog.id, open)).limit(1))[0] : undefined;
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return `/admin/emails${s ? `?${s}` : ""}`;
  };

  return (
    <div className={a.page}>
      <PageHeader
        title="Emails"
        sub={`Every email the site sent to guests and to you: ${Number(counts?.week ?? 0)} this week${Number(counts?.failed) ? `, ${counts.failed} failed` : ""}.`}
      />
      {!integrations.resend() && (
        <p className={`${a.notice} ${a.noticeWarn}`} style={{ marginBottom: 16 }}>
          Test mode: emails are written here but not delivered. Add a Resend API key to send them for real.
        </p>
      )}
      <nav className={a.tabs} aria-label="Email status">
        {STATUSES.map((s) => (
          <Link key={s.v} href={qs({ status: s.v, open: "" })} className={`${a.tab} ${status === s.v ? a.tabActive : ""}`} aria-current={status === s.v ? "page" : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      <form className={a.filters} method="get" role="search" aria-label="Search emails">
        {status && <input type="hidden" name="status" value={status} />}
        <div className={`${a.field} ${a.grow}`}>
          <label htmlFor="eq">Search</label>
          <input id="eq" name="q" type="search" className={a.input} defaultValue={q} placeholder="Email address or subject" />
        </div>
        <button className={`${a.btn} ${a.btnPrimary}`} type="submit">
          Search
        </button>
      </form>

      <div className={selected ? a.splitWide : undefined}>
        <Panel>
          {rows.length === 0 ? (
            <Empty>{q || status ? "No emails match." : "No emails yet."}</Empty>
          ) : (
            <ul className={a.list}>
              {rows.map((m) => (
                <li key={m.id} style={m.id === open ? { background: "var(--a-active)" } : undefined}>
                  <div className={a.listRow}>
                    <div className={a.listMain}>
                      <Link href={qs({ open: m.id })} className={a.rowLink} scroll={false}>
                        {m.subject}
                      </Link>
                      <div className={a.listMeta}>
                        To {m.to}, {fmt(m.createdAt, "MMM d, h:mmaaa")}. {nice(m.template)}
                      </div>
                      {m.error && <p className={`${a.small} ${a.msgErr}`}>{m.error}</p>}
                    </div>
                    <Pill tone={m.status === "failed" ? "danger" : m.status === "sent" ? "success" : "neutral"}>{m.status === "logged" ? "Test" : m.status === "sent" ? "Sent" : "Failed"}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {selected && (
          <Panel
            title={selected.subject}
            action={
              <Link href={qs({ open: "" })} className={`${a.btn} ${a.iconBtn} ${a.btnGhost}`} aria-label="Close preview" scroll={false}>
                <Icon name="close" size={16} />
              </Link>
            }
          >
            <div className={a.panelBody}>
              <p className={`${a.small} ${a.muted}`} style={{ marginBottom: 10 }}>
                To {selected.to} on {fmt(selected.createdAt, "MMM d 'at' h:mmaaa")}
                {selected.bookingId && (
                  <>
                    {" · "}
                    <Link href={`/admin/bookings/${selected.bookingId}`}>Open booking</Link>
                  </>
                )}
              </p>
              {selected.error && <p className={`${a.notice} ${a.noticeDanger}`} style={{ marginBottom: 10 }}>{selected.error}</p>}
              <iframe src={`/api/admin/emails/${selected.id}`} title={`Preview: ${selected.subject}`} className={a.preview} sandbox="" />
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
