/**
 * View models passed to templates. Everything is pre-formatted (New York
 * time, money, language) so templates stay pure and previewable.
 */
import type { Lang } from "./i18n";
import type { PriceLine } from "./components/ui";

export type EmailOutput = { subject: string; element: React.ReactElement };

export type BookingView = {
  lang: Lang;
  id: string;
  code: string;
  theme: string;
  slug: string;
  experienceName: string;
  guestName: string;
  guestFirstName: string;
  guestEmail: string;
  guestPhone: string | null;
  /** "Saturday, November 14, 2026" */
  dateLabel: string;
  /** "2pm – 4pm" */
  timeLabel: string;
  /** "Sat, Nov 14" */
  dateShort: string;
  /** YYYY-MM-DD (New York) for deep links */
  dateKey: string;
  durationLabel: string;
  guests: number;
  guestsLabel: string;
  locationArea: string;
  /** Full address when Alex has entered one (null when it's still a placeholder). */
  address: string | null;
  mapUrl: string | null;
  arrivalInstructions: string;
  includes: string[];
  goodToKnow: string[];
  priceLines: PriceLine[];
  /** Card total (after discounts and gift card). */
  totalPaid: string;
  /** Payment received (or nothing was due); false = still unpaid (manual bookings). */
  paid: boolean;
  /** "Friday, November 13 at 2pm" */
  cancelDeadline: string;
  cancelOpen: boolean;
  cancellationHours: number;
  /** Self-serve link; "" when the email goes to someone who must not manage the booking (gift recipient). */
  manageUrl: string;
  bookUrl: string;
  reviewUrl: string;
  googleCalendarUrl: string;
  occasion: string | null;
  notes: string;
  isGift: boolean;
  giftRecipientName: string | null;
  giftRecipientEmail: string | null;
  giftMessage: string | null;
  hostPhone: string | null;
  hostWhatsapp: string | null;
  deliverableUrl: string | null;
  deliverableReady: boolean;
};
