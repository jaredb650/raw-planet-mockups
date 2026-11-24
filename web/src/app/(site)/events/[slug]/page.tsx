import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCalendar } from "@/components/site/AddToCalendar";
import { DateBlock, EventCard, spotsLabel } from "@/components/site/EventCard";
import { JsonLd } from "@/components/site/JsonLd";
import { SITE_MEDIA } from "@/components/site/media";
import { RsvpForm } from "@/components/site/RsvpForm";
import { breadcrumbJsonLd, eventJsonLd } from "@/components/site/schema";
import { formatMoney } from "@/lib/money";
import { getPublicEvent, getUpcomingEvents } from "@/lib/queries/public";
import { fmt, fmtTimeRange } from "@/lib/time";
import { Breadcrumbs } from "@/components/site/PageHeader";
import styles from "./event.module.css";

/** Most guests a single RSVP can bring. */
const MAX_PARTY = 4;

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getPublicEvent(slug);
  if (!ev) return { title: "Event not found" };
  const when = fmt(ev.startAt, "EEE, MMM d");
  return {
    title: `${ev.title} · ${when}`,
    description: `${ev.summary || ev.description}`.slice(0, 280) || `${ev.title} on ${when} in New York City.`,
    alternates: { canonical: `/events/${ev.slug}` },
    openGraph: { url: `/events/${ev.slug}`, images: [{ url: ev.imageUrl ?? SITE_MEDIA.community.src }] },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const ev = await getPublicEvent(slug);
  if (!ev) notFound();

  const past = new Date(ev.endAt) < new Date();
  const cancelled = ev.status === "cancelled";
  const full = ev.spotsLeft === 0;
  const open = !past && !cancelled;
  const spots = spotsLabel(ev);
  const more = (await getUpcomingEvents(4)).filter((e) => e.id !== ev.id).slice(0, 3);
  const image = ev.imageUrl ?? SITE_MEDIA.community.src;
  const paragraphs = (ev.description || ev.summary).split(/\n{2,}/).filter(Boolean);
  const maxParty = Math.max(1, Math.min(MAX_PARTY, ev.spotsLeft ?? MAX_PARTY));

  return (
    <>
      <JsonLd
        data={[
          eventJsonLd(ev, image),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
            { name: ev.title, path: `/events/${ev.slug}` },
          ]),
        ]}
      />
      <section className={styles.top} aria-labelledby="event-title">
        <div className="wrap">
          <Breadcrumbs crumbs={[{ name: "Events", href: "/events" }, { name: fmt(ev.startAt, "MMM d") }]} />
          <div className={styles.grid}>
            <div className={styles.copy}>
              <div className={styles.dateRow}>
                <DateBlock iso={ev.startAt} size="lg" />
                <p className={styles.when}>
                  <time dateTime={ev.startAt}>{fmt(ev.startAt, "EEEE, MMMM d, yyyy")}</time>
                  <span>{fmtTimeRange(ev.startAt, ev.endAt)} (New York time)</span>
                </p>
              </div>
              <h1 id="event-title" className={styles.title}>
                {ev.title}
              </h1>
              {cancelled ? <p className="notice notice--danger">This event has been cancelled. Sorry about that. See the other dates below.</p> : null}
              {past && !cancelled ? <p className="notice">This event has already happened. See the next dates below.</p> : null}
              {ev.summary ? <p className="lede">{ev.summary}</p> : null}
              <ul className={styles.meta}>
                <li>
                  <strong>Where</strong>
                  <span>
                    {ev.venue || "Raw Planet studio"}
                    {ev.address ? <>, {ev.address}</> : null}
                  </span>
                </li>
                <li>
                  <strong>Cost</strong>
                  <span>{ev.priceCents ? formatMoney(ev.priceCents) : "Free"}</span>
                </li>
                {spots && open ? (
                  <li data-low={ev.spotsLeft != null && ev.spotsLeft <= 5 ? "" : undefined}>
                    <strong>Spots</strong>
                    <span>{spots}</span>
                  </li>
                ) : null}
              </ul>
              {open ? (
                <div className={styles.ctas}>
                  {ev.rsvpEnabled && !full ? (
                    <a href="#rsvp" className="btn btn--accent">
                      RSVP here
                    </a>
                  ) : null}
                  {ev.meetupUrl ? (
                    <a href={ev.meetupUrl} className={`btn ${ev.rsvpEnabled && !full ? "btn--ghost" : "btn--accent"}`} target="_blank" rel="noopener">
                      {ev.rsvpEnabled && !full ? "RSVP on Meetup" : full ? "Join the waitlist on Meetup" : "RSVP on Meetup"} <span aria-hidden="true">↗</span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : null}
                  {ev.externalTicketUrl ? (
                    <a href={ev.externalTicketUrl} className="btn btn--ghost" target="_blank" rel="noopener">
                      Get tickets <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                  <AddToCalendar ev={ev} />
                </div>
              ) : null}
            </div>
            <div className={styles.art}>
              <Image src={image} alt="" fill preload sizes="(max-width: 900px) 92vw, 480px" className={styles.cover} />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.body} aria-label="Event details">
        <div className={`wrap ${styles.bodyGrid}`}>
          <div className={styles.desc}>
            <h2 className={styles.h2}>About this meetup</h2>
            {paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <h3 className={styles.h3}>Good to know</h3>
            <ul className={styles.dots}>
              <li>Beginners are very welcome. You don&rsquo;t need to bring music to come along.</li>
              <li>Bringing a track? Have it on your phone or a USB stick; the speakers are ready.</li>
              <li>The exact entrance details are in your RSVP email.</li>
            </ul>
          </div>
          {open && ev.rsvpEnabled ? (
            <div className={styles.rsvp} id="rsvp">
              <h2 className={styles.h2}>{full ? "This one is full" : "Save your spot"}</h2>
              {full ? (
                <p className="muted">
                  All spots are taken.{" "}
                  {ev.meetupUrl ? (
                    <a href={ev.meetupUrl} className="link" target="_blank" rel="noopener">
                      Join the waitlist on Meetup
                    </a>
                  ) : (
                    "Check the next date below."
                  )}
                </p>
              ) : (
                <RsvpForm slug={ev.slug} title={ev.title} maxGuests={maxParty} meetupUrl={ev.meetupUrl} />
              )}
            </div>
          ) : null}
        </div>
      </section>

      {more.length ? (
        <section className={styles.more} aria-labelledby="more-title">
          <div className="wrap">
            <div className={styles.moreHead}>
              <h2 id="more-title" className={styles.h2}>
                {open ? "More dates" : "Next up"}
              </h2>
              <Link href="/events" className="link">
                All events
              </Link>
            </div>
            <div className={styles.moreList}>
              {more.map((m) => (
                <EventCard key={m.id} ev={m} compact />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
