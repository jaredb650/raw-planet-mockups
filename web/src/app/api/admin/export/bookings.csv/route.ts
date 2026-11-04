import { adminGuard } from "@/lib/auth";
import { listBookings, parseBookingFilters } from "@/lib/admin/bookings";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { SOURCE_LABEL, BOOKING_STATUS, PAYMENT_STATUS } from "@/components/admin/format";
import { fmt, todayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const f = parseBookingFilters(new URL(req.url).searchParams);
  const { rows } = await listBookings(f, { limit: 10_000 });
  const money = (c: number) => (c / 100).toFixed(2);
  const body = toCsv(
    ["Code", "Date", "Start", "End", "Experience", "Guests", "Name", "Email", "Phone", "Source", "External ref", "Status", "Payment", "Total", "Paid", "Refunded", "Net", "Occasion", "Gift", "Booked at"],
    rows.map((b) => [
      b.code,
      fmt(b.startAt, "yyyy-MM-dd"),
      fmt(b.startAt, "HH:mm"),
      fmt(b.endAt, "HH:mm"),
      b.experienceName,
      b.guests,
      b.contactName,
      b.contactEmail.endsWith("@rawplanet.invalid") ? "" : b.contactEmail,
      b.contactPhone,
      SOURCE_LABEL[b.source] ?? b.source,
      b.externalRef,
      BOOKING_STATUS[b.status]?.label ?? b.status,
      PAYMENT_STATUS[b.paymentStatus]?.label ?? b.paymentStatus,
      money(b.totalCents),
      money(b.amountPaidCents),
      money(b.amountRefundedCents),
      money(b.amountPaidCents - b.amountRefundedCents),
      b.occasion,
      b.isGift ? "yes" : "",
      fmt(b.createdAt, "yyyy-MM-dd HH:mm"),
    ]),
  );
  return csvResponse(`raw-planet-bookings-${f.view}-${todayKey()}.csv`, body);
}
