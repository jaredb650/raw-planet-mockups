"use client";

import type { PublicExperience } from "@/lib/queries/public";
import { BookingPicker } from "./BookingPicker";

/**
 * Public booking widget (contract with the site agent).
 * - `experiences`: from getActiveExperiences()
 * - `initialSlug`: preselect an experience tab
 * - `compact`: single-experience, single-column version for sidebars
 *   (with `initialSlug`, only that experience is shown)
 * Continue → /book/[slug]?date=&start=&duration=&guests=
 */
export function BookingWidget({
  experiences,
  initialSlug,
  compact,
}: {
  experiences: PublicExperience[];
  initialSlug?: string;
  compact?: boolean;
}) {
  return <BookingPicker experiences={experiences} initialSlug={initialSlug} compact={compact} />;
}

export default BookingWidget;
