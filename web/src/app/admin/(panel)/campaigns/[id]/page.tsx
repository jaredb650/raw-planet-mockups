import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { campaignRecipients, campaigns } from "@/lib/db/schema";
import { experienceOptions } from "@/lib/admin/bookings";
import { campaignStats, countRecipients, POSTAL_ADDRESS_MISSING, postalAddress } from "@/lib/admin/campaigns";
import { listTags } from "@/lib/admin/customers";
import { hostNotificationEmail, integrations } from "@/lib/config";
import { fmt } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ActionForm";
import { CampaignEditor } from "@/components/admin/CampaignEditor";
import { CampaignStatusPill, TestModeNotice } from "@/components/admin/CampaignBits";
import { plural } from "@/components/admin/format";
import { continueCampaignAction, saveCampaignAction, sendCampaignAction, testCampaignAction } from "../actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Campaign" };
// The send action runs under this page and works through a list for up to ~45 seconds.
export const maxDuration = 60;

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await getDb();
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) notFound();
  const testMode = !integrations.resend();
  const header = <PageHeader back={{ href: "/admin/campaigns", label: "Campaigns" }} title={c.name} actions={<CampaignStatusPill status={c.status} />} />;
  const preview = (
    <Panel title="Preview">
      <div className={a.panelBody}>
        <iframe key={c.updatedAt.getTime()} className={a.preview} title="Email preview" sandbox="" src={`/api/admin/campaigns/${c.id}/preview`} />
      </div>
    </Panel>
  );

  if (c.status === "draft") {
    const [tags, exps, count, address] = await Promise.all([listTags(), experienceOptions(), countRecipients(c.segment), postalAddress()]);
    return (
      <div className={a.page}>
        {header}
        {testMode && <TestModeNotice />}
        <div className={a.split}>
          <div className={a.stack}>
            <Panel title="Write it">
              <div className={a.panelBody}>
                <CampaignEditor
                  action={saveCampaignAction}
                  campaign={c}
                  tags={tags}
                  experiences={exps.map((e) => ({ id: e.id, name: e.shortName }))}
                />
              </div>
            </Panel>
            {preview}
          </div>
          <div className={a.stack}>
            <Panel title="Send a test">
              <div className={a.panelBody}>
                <ActionForm action={testCampaignAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <p className={a.hint}>Goes only to {hostNotificationEmail()}, using the last saved version.</p>
                  <div className={a.formFoot}>
                    <SubmitButton className={a.btn} pendingText="Sending…">
                      Send me a test
                    </SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </Panel>
            <Panel title="Send it">
              <div className={a.panelBody}>
                {!address ? (
                  <p className={`${a.notice} ${a.noticeWarn}`}>
                    {POSTAL_ADDRESS_MISSING} <Link href="/admin/settings">Open Settings</Link>
                  </p>
                ) : count === 0 ? (
                  <p className={a.hint}>Nobody matches this audience yet.</p>
                ) : (
                  <ActionForm action={sendCampaignAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="expected" value={count} />
                    <p className={a.hint}>Sends the last saved version{testMode ? ". In test mode it’s only logged" : ""}. This can’t be undone.</p>
                    <div className={a.formFoot}>
                      <ConfirmSubmit className={`${a.btn} ${a.btnPrimary}`} confirmLabel={`Yes, send to ${plural(count, "person", "people")}`} question={`Send this to exactly ${plural(count, "person", "people")}?`}>
                        Send campaign
                      </ConfirmSubmit>
                    </div>
                  </ActionForm>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  const [stats, failures] = await Promise.all([
    campaignStats([c.id]),
    db
      .select({ id: campaignRecipients.id, email: campaignRecipients.email, error: campaignRecipients.error })
      .from(campaignRecipients)
      .where(and(eq(campaignRecipients.campaignId, c.id), eq(campaignRecipients.status, "failed")))
      .orderBy(desc(campaignRecipients.createdAt), asc(campaignRecipients.email))
      .limit(100),
  ]);
  const s = stats.get(c.id)!;
  return (
    <div className={a.page}>
      {header}
      {s.testOnly > 0 && (
        <p className={`${a.notice} ${a.noticeWarn}`} style={{ marginBottom: 16 }}>
          <strong>Test mode:</strong> {plural(s.testOnly, "email")} of these {s.testOnly === 1 ? "was" : "were"} only logged in Emails. Nobody received {s.testOnly === 1 ? "it" : "them"}.
        </p>
      )}
      {c.status === "sending" && (
        <div className={`${a.notice}`} style={{ marginBottom: 16 }}>
          <ActionForm action={continueCampaignAction} className={a.row}>
            <input type="hidden" name="id" value={c.id} />
            <span>{plural(s.pending, "email")} still to go. They go out with the next automation run, or send more now.</span>
            <SubmitButton className={`${a.btn} ${a.btnSm}`} pendingText="Sending…">
              Send the next batch
            </SubmitButton>
          </ActionForm>
        </div>
      )}
      <div className={a.kpis} style={{ ["--kpi-cols" as string]: 4, marginBottom: 16 }}>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Sent</div>
          <div className={a.kpiValue}>{s.sent}</div>
          {c.sentAt && <div className={a.kpiNote}>{fmt(c.sentAt, "MMM d, yyyy")}</div>}
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Failed</div>
          <div className={a.kpiValue}>{s.failed}</div>
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Bookings</div>
          <div className={a.kpiValue}>{s.bookings}</div>
          <div className={a.kpiNote}>By recipients, within 30 days</div>
        </div>
        <div className={a.kpi}>
          <div className={a.kpiLabel}>Revenue</div>
          <div className={a.kpiValue}>{formatMoney(s.revenueCents)}</div>
          <div className={a.kpiNote}>Paid, minus refunds</div>
        </div>
      </div>
      <div className={a.stack}>
        {failures.length > 0 && (
          <Panel title="Didn’t go through" count={s.failed}>
            <ul className={a.list}>
              {failures.map((f) => (
                <li key={f.id}>
                  <div className={a.listTitle}>{f.email}</div>
                  <div className={a.listMeta}>{f.error}</div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {preview}
      </div>
    </div>
  );
}
