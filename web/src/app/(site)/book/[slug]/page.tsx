import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getAvailability, getExperienceBySlugOrId } from "@/lib/booking/availability";
import { expireBooking, getBookingForCustomer } from "@/lib/booking/service";
import { getPublicExperience } from "@/lib/queries/public";
import { localDateKey } from "@/lib/time";
import { BookingPicker } from "@/components/booking/BookingPicker";
import { CheckoutForm } from "@/components/booking/CheckoutForm";
import { clampGuests, defaultGuests, privateRateOf } from "@/components/booking/format";
import styles from "@/components/booking/pages.module.css";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = await getPublicExperience(slug);
  return {
    title: e ? `Book ${e.shortName.toLowerCase()}` : "Book a session",
    robots: { index: false, follow: true },
    referrer: "same-origin", // ?cancelled=…&t=<manage token> must not leak to other sites
  };
}

export default async function BookExperiencePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const experience = await getPublicExperience(slug);
  if (!experience) notFound();

  // Back from Stripe without paying: release the hold straight away.
  let notice: string | null = null;
  const cancelled = one(sp.cancelled);
  if (cancelled && /^RP-[A-Z0-9]{4,12}$/i.test(cancelled)) {
    // Only the guest who started this checkout (holder of the manage token) can release the hold.
    const b = await getBookingForCustomer(cancelled.toUpperCase(), one(sp.t) ?? "");
    if (b && b.experienceId === experience.id && b.status === "pending_payment") {
      await expireBooking(b.id, "Guest left checkout without paying");
    }
    notice = "No payment was taken and your spot was released. Pick a time again whenever you're ready.";
  }

  const privateParam = one(sp.private);
  const isPrivate = (privateParam === "1" || privateParam === "true") && Boolean(privateRateOf(experience));
  const durationParam = Number(one(sp.duration));
  const duration = experience.durationOptions.some((o) => o.minutes === durationParam)
    ? durationParam
    : Math.min(...experience.durationOptions.map((o) => o.minutes));
  const guestsParam = Number(one(sp.guests));
  const guests = Number.isFinite(guestsParam) && guestsParam > 0 ? clampGuests(experience, guestsParam, isPrivate) : undefined;
  const startParam = one(sp.start);
  const startDate = startParam ? new Date(startParam) : null;
  let dateKey = one(sp.date);

  // A specific time was chosen: re-check it's still free before asking for details.
  let slot: { start: string; end: string; adjustPercent?: number; seatsLeft?: number } | null = null;
  if (!cancelled && startDate && !Number.isNaN(startDate.getTime())) {
    dateKey = localDateKey(startDate);
    const db = await getDb();
    const full = await getExperienceBySlugOrId(db, experience.slug);
    if (full) {
      const { days } = await getAvailability({
        experience: full,
        fromKey: dateKey,
        toKey: dateKey,
        durationMinutes: duration,
        isPrivate,
      });
      const match = days[0]?.slots.find((s) => s.start === startDate.toISOString());
      if (match?.available) slot = { start: match.start, end: match.end, adjustPercent: match.adjustPercent, seatsLeft: match.seatsLeft };
      else notice = isPrivate
        ? "Sorry, that private time slot is no longer completely open. Here's what's still available."
        : "Sorry, that time was just taken. Here's what's still open.";
    }
  }

  if (slot && dateKey) {
    return (
      <section className={styles.page}>
        <div className="wrap">
          <Link
            href={`/book?${new URLSearchParams({
              experience: experience.slug,
              date: dateKey,
              ...(isPrivate ? { private: "1" } : {}),
            })}`}
            className={styles.back}
          >
            <span aria-hidden="true">←</span> Back to times
          </Link>
          <header className={styles.head}>
            <div>
              <p className="eyebrow">{isPrivate ? "Private session · Almost there" : "Almost there"}</p>
              <h1 className={styles.titleSm}>Your details</h1>
            </div>
          </header>
          <CheckoutForm
            experience={experience}
            date={dateKey}
            start={slot.start}
            end={slot.end}
            duration={duration}
            initialGuests={
              isPrivate
                ? (guests ?? defaultGuests(experience, true))
                : Math.min(guests ?? defaultGuests(experience), slot.seatsLeft ?? experience.maxGuests)
            }
            isPrivate={isPrivate}
            adjustPercent={slot.adjustPercent}
            seatsLeft={slot.seatsLeft}
          />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className="wrap">
        <header className={styles.head}>
          <div>
            <p className="eyebrow">Book {experience.shortName.toLowerCase()}</p>
            <h1 className={styles.title}>Pick a time</h1>
          </div>
          <p className="lede">
            {experience.name}.{" "}
            <Link href="/book" className="link">
              See all experiences
            </Link>
          </p>
        </header>
        <BookingPicker
          experiences={[experience]}
          initialSlug={experience.slug}
          initialDate={dateKey}
          initialDuration={duration}
          initialGuests={guests}
          initialPrivate={isPrivate}
          notice={notice}
        />
      </div>
    </section>
  );
}
