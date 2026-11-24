"use client";

/**
 * Mount point for the booking engineer's <BookingWidget> on site pages
 * (home #book, experience pages #book). Kept as a thin wrapper so pages don't
 * import from the booking package directly.
 */
import { BookingWidget } from "@/components/booking/BookingWidget";
import type { PublicExperience } from "@/lib/queries/public";

export function BookingSlot({
  experiences,
  initialSlug,
  compact,
}: {
  experiences: PublicExperience[];
  initialSlug?: string;
  compact?: boolean;
}) {
  return <BookingWidget experiences={experiences} initialSlug={initialSlug} compact={compact} />;
}
