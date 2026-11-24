import { adminGuard } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { getReport, parseRange, reportCsvRows } from "@/lib/admin/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const range = parseRange(Object.fromEntries(new URL(req.url).searchParams));
  const report = await getReport(range);
  return csvResponse(`raw-planet-report-${range.from}-to-${range.to}.csv`, toCsv(["Section", "Item", "Value", "Unit"], reportCsvRows(report)));
}
