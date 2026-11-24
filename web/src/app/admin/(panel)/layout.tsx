import { requireAdmin } from "@/lib/auth";
import { getBadges } from "@/lib/admin/badges";
import { Shell } from "@/components/admin/Shell";
import { logout } from "../login/actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const b = await getBadges();
  return (
    <Shell
      logout={logout}
      badges={{
        today: b.deliverables + b.calendarErrors,
        inquiries: b.inquiries,
        reviews: b.reviews,
        availability: b.feedErrors,
        emails: b.failedEmails,
      }}
    >
      {children}
    </Shell>
  );
}
