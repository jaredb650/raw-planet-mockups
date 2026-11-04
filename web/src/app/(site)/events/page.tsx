import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EventCard } from "@/components/site/EventCard";
import { JsonLd } from "@/components/site/JsonLd";
import { SITE_MEDIA } from "@/components/site/media";
import { PageHeader } from "@/components/site/PageHeader";
import { breadcrumbJsonLd, eventJsonLd } from "@/components/site/schema";
import { BUSINESS } from "@/lib/config";
import { getUpcomingEvents } from "@/lib/queries/public";
import styles from "./events.module.css";

export const metadata: Metadata = {
  title: "Community events & meetups",
  description:
    "Free biweekly meetups for people making music in New York City: listening sessions, feedback circles and good company, hosted by Raw Planet. Beginners welcome.",
  alternates: { canonical: "/events" },
  openGraph: { url: "/events" },
};

const WHAT_HAPPENS = [
  { t: "Bring a track", d: "Finished, half-finished or a voice memo. Play it on the big speakers if you want to." },
  { t: "Get real feedback", d: "Kind, specific notes from producers, DJs and curious listeners. You choose how deep it goes." },
  { t: "Meet your people", d: "Collaborators, vocalists, someone to go to shows with. The best part is often after the music stops." },
];

export default async function EventsPage() {
  const events = await getUpcomingEvents(24);
  const meetup = BUSINESS.meetupGroupUrl || events.find((e) => e.meetupUrl)?.meetupUrl || "";
  const img = SITE_MEDIA.community;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
          ]),
          ...events.slice(0, 10).map((ev) => eventJsonLd(ev, ev.imageUrl ?? img.src)),
        ]}
      />
      <PageHeader
        crumbs={[{ name: "Events" }]}
        eyebrow="Community events & meetups"
        title="Come hang out between sessions."
        lede="Every other week we open the studio to people making music in New York. Listening sessions, feedback circles and good company. Free, and beginners are very welcome."
        aside={
          <div className={styles.headArt}>
            <div className={styles.headImg}>
              <Image src={img.src} alt={img.alt} fill preload sizes="(max-width: 900px) 92vw, 440px" className={styles.cover} />
            </div>
            <div className={styles.sticker} aria-hidden="true">
              Every other week
            </div>
          </div>
        }
      >
        <div className={styles.headCtas}>
          <a href="#upcoming" className="btn btn--accent">
            See upcoming dates
          </a>
          {meetup ? (
            <a href={meetup} className="btn btn--ghost" target="_blank" rel="noopener">
              Follow on Meetup <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </PageHeader>

      <section className={styles.upcoming} id="upcoming" aria-labelledby="upcoming-title">
        <div className="wrap">
          <div className={styles.listHead}>
            <h2 id="upcoming-title">Upcoming</h2>
            <p className="muted">RSVP here or on Meetup; either one saves your spot. Times are New York time.</p>
          </div>
          {events.length ? (
            <div className={styles.list}>
              {events.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>The next meetup is being scheduled.</p>
              <p className="muted">
                {meetup ? (
                  <>
                    <a href={meetup} className="link" target="_blank" rel="noopener">
                      Follow the group on Meetup
                    </a>{" "}
                    to hear first, or{" "}
                  </>
                ) : null}
                <Link href="/contact" className="link">
                  drop us a line
                </Link>{" "}
                and we&rsquo;ll let you know.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.how} aria-labelledby="how-title">
        <div className="wrap">
          <h2 id="how-title" className={styles.howTitle}>
            What happens at a meetup
          </h2>
          <ul className={styles.howList}>
            {WHAT_HAPPENS.map((w) => (
              <li key={w.t}>
                <h3>{w.t}</h3>
                <p>{w.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.next} aria-labelledby="next-title">
        <div className={`wrap ${styles.nextGrid}`}>
          <div>
            <h2 id="next-title">Want more than a meetup?</h2>
            <p>Book a private session and make your own track, or play your first DJ set with Alex.</p>
          </div>
          <div className={styles.nextBtns}>
            <Link href="/experiences" className="btn btn--light">
              See the experiences
            </Link>
            <Link href="/groups" className="btn btn--ghost">
              Host your own event
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
