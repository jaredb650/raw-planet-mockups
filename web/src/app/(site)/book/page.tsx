import type { Metadata } from "next";
import { BookingPicker } from "@/components/booking/BookingPicker";
import { getActiveExperiences } from "@/lib/queries/public";
import styles from "@/components/booking/pages.module.css";

export const metadata: Metadata = {
  title: "Book a session",
  description: "Pick an experience, a day and a start time. See live availability and book in a minute. Free cancellation.",
  alternates: { canonical: "/book" },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const experiences = await getActiveExperiences();
  const slug = one(sp.experience);
  const initialSlug = experiences.some((e) => e.slug === slug) ? slug : undefined;
  const guests = Number(one(sp.guests));
  const duration = Number(one(sp.duration));

  return (
    <section className={styles.page}>
      <div className="wrap">
        <header className={styles.head}>
          <div>
            <p className="eyebrow">Book a session</p>
            <h1 className={styles.title}>Find your time</h1>
          </div>
          <p className="lede">
            Sessions start every two hours from 10am. Pick the room you want, then a day and a start time. You&rsquo;ll see the
            full price before you pay.
          </p>
        </header>
        <BookingPicker
          experiences={experiences}
          initialSlug={initialSlug}
          initialDate={one(sp.date)}
          initialDuration={Number.isFinite(duration) ? duration : undefined}
          initialGuests={Number.isFinite(guests) && guests > 0 ? guests : undefined}
        />
      </div>
    </section>
  );
}
