import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSetting, getStringSetting } from "@/lib/automation/settings";
import { BUSINESS, hostNotificationEmail, integrations, siteUrl } from "@/lib/config";
import { fmt } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Pill } from "@/components/admin/Pill";
import { logout } from "../../login/actions";
import { runAutomationsAction, saveContactAction } from "./actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const [hostPhone, hostWhatsapp, lastRun] = await Promise.all([
    getStringSetting("hostPhone"),
    getStringSetting("hostWhatsapp"),
    getSetting<{ at: string; ok: boolean }>("lastCronRun"),
  ]);
  const env = (k: string) => Boolean(process.env[k]);
  const checks: { name: string; on: boolean; what: string; off: string }[] = [
    { name: "Stripe payments", on: integrations.stripe(), what: "Guests pay by card at checkout.", off: "Test checkout only. Add STRIPE_SECRET_KEY and the webhook secret." },
    { name: "Cal.com + Google Calendar", on: integrations.calcom(), what: "Every booking checks and lands on your Google Calendar.", off: "Add CALCOM_API_KEY and each experience’s event type ID." },
    { name: "Email sending (Resend)", on: integrations.resend(), what: "Confirmations, reminders and follow-ups go out.", off: "Emails are only logged. Add RESEND_API_KEY." },
    { name: "Spam protection (Turnstile)", on: integrations.turnstile(), what: "Booking, gift card and contact forms check for bots.", off: "Forms only have rate limits. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY." },
    { name: "Scheduled automations", on: env("CRON_SECRET"), what: "Reminders, follow-ups and calendar sync run every 10 minutes.", off: "Add CRON_SECRET so the scheduler can run them." },
    { name: "Admin password", on: env("ADMIN_PASSWORD") && env("AUTH_SECRET"), what: "Set from ADMIN_PASSWORD.", off: "Using the development password. Set ADMIN_PASSWORD and AUTH_SECRET before going live." },
  ];
  const now = new Date();
  const stale = lastRun ? now.getTime() - new Date(lastRun.at).getTime() > 30 * 60_000 : true;

  return (
    <div className={`${a.page} ${a.pageNarrow}`}>
      <PageHeader title="Settings" sub={`${BUSINESS.name} · ${siteUrl()}`} />
      <div className={a.stack}>
        <Panel title="Your contact details in emails">
          <div className={a.panelBody}>
            <ActionForm action={saveContactAction}>
              <p className={a.hint}>Shown to guests in confirmations and reminders so they can reach you on the day.</p>
              <div className={a.formRow}>
                <div className={a.field}>
                  <label htmlFor="s-phone">Phone</label>
                  <input id="s-phone" name="hostPhone" type="tel" className={a.input} defaultValue={hostPhone ?? ""} placeholder="+1 917 555 0100" />
                </div>
                <div className={a.field}>
                  <label htmlFor="s-wa">WhatsApp</label>
                  <input id="s-wa" name="hostWhatsapp" type="tel" className={a.input} defaultValue={hostWhatsapp ?? ""} placeholder="Same as phone, or leave blank" />
                </div>
              </div>
              <p className={a.hint}>
                Booking alerts go to <strong>{hostNotificationEmail()}</strong> (set by HOST_NOTIFICATION_EMAIL).
              </p>
              <div className={a.formFoot}>
                <SubmitButton pendingText="Saving…">Save</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </Panel>

        <Panel title="Automations">
          <div className={a.panelBody}>
            <p>
              Last run:{" "}
              {lastRun ? (
                <>
                  <strong>{fmt(lastRun.at, "MMM d, h:mmaaa")}</strong> {lastRun.ok ? <Pill tone={stale ? "warning" : "success"}>{stale ? "Not running lately" : "OK"}</Pill> : <Pill tone="danger">Had errors</Pill>}
                </>
              ) : (
                <Pill tone="warning">Never</Pill>
              )}
            </p>
            <p className={a.hint} style={{ margin: "6px 0 12px" }}>
              Sends reminders, follow-ups, review requests, gift cards on their delivery date and your morning digest, releases unpaid holds and syncs calendars.
            </p>
            <ActionForm action={runAutomationsAction} className={a.row}>
              <SubmitButton className={a.btn} pendingText="Running…">
                Run now
              </SubmitButton>
            </ActionForm>
          </div>
        </Panel>

        <Panel title="Connections">
          <ul className={a.list}>
            {checks.map((c) => (
              <li key={c.name} className={a.listRow}>
                <div className={a.listMain}>
                  <div className={a.listTitle}>{c.name}</div>
                  <div className={a.listMeta}>{c.on ? c.what : c.off}</div>
                </div>
                {c.on ? <Pill tone="success">On</Pill> : <Pill tone="warning">Not set up</Pill>}
              </li>
            ))}
          </ul>
          <div className={a.panelFoot}>
            <span className={a.muted}>Keys live in the hosting environment (Vercel → Settings → Environment variables). Setup steps are in docs/SETUP.md.</span>
          </div>
        </Panel>

        <Panel title="Calendars">
          <div className={a.panelBody}>
            <p className={a.hint}>
              Imported calendars, blocked time and your private calendar link are on <Link href="/admin/availability">Availability</Link>.
            </p>
          </div>
        </Panel>

        <Panel title="Account">
          <div className={a.panelBody}>
            <p className={a.hint} style={{ marginBottom: 12 }}>
              The admin password is set in the hosting environment (ADMIN_PASSWORD). Changing it, or AUTH_SECRET, signs everyone out.
            </p>
            <form action={logout}>
              <button type="submit" className={a.btn}>
                Sign out
              </button>
            </form>
          </div>
        </Panel>
      </div>
    </div>
  );
}
