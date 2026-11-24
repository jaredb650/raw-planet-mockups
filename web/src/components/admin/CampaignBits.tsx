import type { Campaign } from "@/lib/db/schema";
import { Pill } from "./Pill";
import a from "./admin.module.css";

export function CampaignStatusPill({ status }: { status: Campaign["status"] }) {
  if (status === "sent") return <Pill tone="success">Sent</Pill>;
  return status === "sending" ? <Pill tone="info">Sending</Pill> : <Pill>Draft</Pill>;
}

export function TestModeNotice() {
  return (
    <p className={`${a.notice} ${a.noticeWarn}`} style={{ marginBottom: 16 }}>
      <strong>Test mode:</strong> email sending isn&rsquo;t connected, so campaigns are only logged in Emails. No guest receives anything until RESEND_API_KEY is added.
    </p>
  );
}
