import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { campaignStats } from "@/lib/admin/campaigns";
import { integrations } from "@/lib/config";
import { fmt } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { CampaignStatusPill, TestModeNotice } from "@/components/admin/CampaignBits";
import { createCampaignAction } from "./actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  await requireAdmin();
  const db = await getDb();
  const list = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  const stats = await campaignStats(list.map((c) => c.id));

  return (
    <div className={a.page}>
      <PageHeader
        title="Campaigns"
        sub="Email guests who said yes to news, and see the bookings it brings in."
        actions={
          <ActionForm action={createCampaignAction} className={a.row}>
            <SubmitButton pendingText="Creating…">New campaign</SubmitButton>
          </ActionForm>
        }
      />
      {!integrations.resend() && <TestModeNotice />}

      <Panel>
        {list.length === 0 ? (
          <Empty>No campaigns yet. Start one and pick who it goes to.</Empty>
        ) : (
          <div className={a.tableWrap}>
            <table className={`${a.table} ${a.tableStack}`}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th className={a.num}>Sent</th>
                  <th className={a.num}>Bookings</th>
                  <th className={a.num}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const s = stats.get(c.id)!;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/campaigns/${c.id}`} className={a.rowLink}>
                          {c.name}
                        </Link>
                        <span className={a.cellSub}>{c.sentAt ? `Sent ${fmt(c.sentAt, "MMM d, yyyy")}` : c.subject || "No subject yet"}</span>
                      </td>
                      <td>
                        <CampaignStatusPill status={c.status} />
                      </td>
                      <td className={a.num} data-label="Sent">
                        {s.sent}
                      </td>
                      <td className={a.num} data-label="Bookings">
                        {s.bookings}
                      </td>
                      <td className={a.num} data-label="Revenue">
                        {s.revenueCents ? formatMoney(s.revenueCents) : <span className={a.dash}>–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
