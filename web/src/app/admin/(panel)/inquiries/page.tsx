import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { experiences, inquiries } from "@/lib/db/schema";
import { fmt, fromLocal } from "@/lib/time";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import { telHref } from "@/components/admin/format";
import { setInquiryStatusAction } from "./actions";
import a from "@/components/admin/admin.module.css";
import q from "@/components/admin/inquiries.module.css";

export const metadata = { title: "Inquiries" };

const TABS = [
  { v: "new", label: "New" },
  { v: "replied", label: "Replied" },
  { v: "converted", label: "Booked" },
  { v: "closed", label: "Closed" },
  { v: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["v"];
const KIND: Record<string, string> = { group: "Group", private_event: "Private event", corporate: "Team / corporate", general: "Question", press: "Press" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const open = one(sp.open);
  const db = await getDb();
  const [counts] = await db
    .select({
      new: sql<number>`count(*) filter (where ${inquiries.status} = 'new')::int`,
      replied: sql<number>`count(*) filter (where ${inquiries.status} = 'replied')::int`,
      converted: sql<number>`count(*) filter (where ${inquiries.status} = 'converted')::int`,
      closed: sql<number>`count(*) filter (where ${inquiries.status} = 'closed')::int`,
      all: sql<number>`count(*)::int`,
    })
    .from(inquiries);
  const req = one(sp.status) as Tab;
  const tab: Tab = TABS.some((t) => t.v === req) ? req : open ? "all" : "new";
  const rows = await db
    .select({ i: inquiries, exp: experiences.shortName })
    .from(inquiries)
    .leftJoin(experiences, eq(experiences.id, inquiries.experienceId))
    .where(tab === "all" ? undefined : eq(inquiries.status, tab))
    .orderBy(desc(inquiries.createdAt))
    .limit(200);

  return (
    <div className={`${a.page} ${a.pageNarrow}`}>
      <PageHeader title="Inquiries" sub="Group, private-event and team requests from the website. Reply, then turn the good ones into bookings." />
      <nav className={a.tabs} aria-label="Inquiry status">
        {TABS.map((t) => (
          <Link key={t.v} href={`/admin/inquiries?status=${t.v}`} className={`${a.tab} ${tab === t.v ? a.tabActive : ""}`} aria-current={tab === t.v ? "page" : undefined}>
            {t.label}
            <span className={a.tabCount}>{Number(counts?.[t.v] ?? 0)}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Panel>
          <Empty>{tab === "new" ? "No new inquiries. You’re all caught up." : "Nothing here."}</Empty>
        </Panel>
      ) : (
        <div className={a.stack}>
          {rows.map(({ i, exp }) => {
            const subject = `Re: your ${KIND[i.kind]?.toLowerCase() ?? ""} inquiry at Raw Planet`;
            return (
              <article key={i.id} id={`inq-${i.id}`} className={`${a.panel} ${q.card} ${open === i.id ? q.open : ""}`}>
                <header className={q.head}>
                  <div>
                    <div className={q.name}>{i.name}</div>
                    <div className={a.listMeta}>
                      {KIND[i.kind] ?? i.kind}
                      {i.groupSize ? `, ${i.groupSize} people` : ""}
                      {exp ? `, ${exp}` : ""}
                      {i.preferredDate ? `, wants ${/^\d{4}-\d{2}-\d{2}$/.test(i.preferredDate) ? fmt(fromLocal(i.preferredDate, "12:00"), "EEE MMM d") : i.preferredDate}` : ""}
                    </div>
                  </div>
                  <div className={q.when}>
                    {i.status === "new" ? <Pill tone="accent">New</Pill> : i.status === "converted" ? <Pill tone="success">Booked</Pill> : i.status === "replied" ? <Pill tone="info">Replied</Pill> : <Pill tone="neutral">Closed</Pill>}
                    <span className={`${a.small} ${a.muted}`}>{fmt(i.createdAt, "MMM d, h:mmaaa")}</span>
                  </div>
                </header>
                {i.message && <p className={q.msg}>{i.message}</p>}
                <div className={q.contact}>
                  <a href={`mailto:${i.email}`}>{i.email}</a>
                  {i.phone && <a href={`tel:${telHref(i.phone)}`}>{i.phone}</a>}
                </div>
                <div className={q.actions}>
                  <a className={`${a.btn} ${a.btnSm} ${a.btnPrimary}`} href={`mailto:${i.email}?subject=${encodeURIComponent(subject)}`}>
                    <Icon name="mail" size={15} /> Reply by email
                  </a>
                  {i.phone && (
                    <a className={`${a.btn} ${a.btnSm}`} href={`sms:${telHref(i.phone)}`}>
                      <Icon name="sms" size={15} /> Text
                    </a>
                  )}
                  {i.status !== "converted" && (
                    <Link className={`${a.btn} ${a.btnSm}`} href={`/admin/bookings/new?inquiry=${i.id}`}>
                      <Icon name="plus" size={15} /> Make a booking
                    </Link>
                  )}
                  <ActionForm action={setInquiryStatusAction} className={a.row} hideMessage>
                    <input type="hidden" name="id" value={i.id} />
                    {i.status === "new" && (
                      <SubmitButton name="status" value="replied" className={`${a.btn} ${a.btnSm}`}>
                        Mark replied
                      </SubmitButton>
                    )}
                    {i.status !== "closed" && i.status !== "converted" && (
                      <SubmitButton name="status" value="closed" className={`${a.btn} ${a.btnSm} ${a.btnGhost}`}>
                        Close
                      </SubmitButton>
                    )}
                    {(i.status === "closed" || i.status === "converted") && (
                      <SubmitButton name="status" value="new" className={`${a.btn} ${a.btnSm} ${a.btnGhost}`}>
                        Reopen
                      </SubmitButton>
                    )}
                  </ActionForm>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
