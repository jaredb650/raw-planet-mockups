import { adminGuard } from "@/lib/auth";
import { listCustomers, parseCustomerFilters } from "@/lib/admin/customers";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { SOURCE_LABEL } from "@/components/admin/format";
import { fmt, todayKey } from "@/lib/time";
import type { BookingSource } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const f = parseCustomerFilters(new URL(req.url).searchParams);
  const { rows } = await listCustomers(f, { limit: 50_000 });
  const body = toCsv(
    ["Name", "Email", "Phone", "News opt-in", "Language", "Sessions", "Spent", "Last session", "Next session", "Sources", "Customer since"],
    rows.map((c) => [
      c.name,
      c.hasEmail ? c.email : "",
      c.phone,
      c.marketingOptIn ? "yes" : "no",
      c.language,
      c.sessions,
      (c.spent / 100).toFixed(2),
      c.lastAt ? fmt(c.lastAt, "yyyy-MM-dd") : "",
      c.nextAt ? fmt(c.nextAt, "yyyy-MM-dd") : "",
      c.sources.map((s) => SOURCE_LABEL[s as BookingSource] ?? s).join("; "),
      fmt(c.createdAt, "yyyy-MM-dd"),
    ]),
  );
  return csvResponse(`raw-planet-customers${f.optIn ? "-opted-in" : ""}-${todayKey()}.csv`, body);
}
