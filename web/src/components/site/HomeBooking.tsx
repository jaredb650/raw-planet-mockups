"use client";

import type { PublicExperience } from "@/lib/queries/public";
import { BookingSlot } from "./BookingSlot";
import { useMood } from "./MoodContext";

/** Booking widget on the home page, following the mood chooser's pick. */
export function HomeBooking({ experiences }: { experiences: PublicExperience[] }) {
  const { slug } = useMood();
  return <BookingSlot key={slug} experiences={experiences} initialSlug={slug} />;
}
