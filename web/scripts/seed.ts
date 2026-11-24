/**
 * Seed the database with Raw Planet's real experiences and Airbnb reviews.
 *
 *   npm run db:seed            # experiences, add-ons (disabled), reviews — safe to re-run
 *   npm run db:seed -- --demo  # also sample bookings, events, inquiries, gift card & promo for demos
 *
 * Re-running updates experience copy/pricing by slug but never deletes data.
 */
import { eq } from "drizzle-orm";
import { createDb } from "../src/lib/db";
import * as s from "../src/lib/db/schema";
import { newBookingCode, newToken } from "../src/lib/ids";
import { addDaysKey, fromLocal, todayKey } from "../src/lib/time";
import { djPhotos, meditationStills, productionPhotos, reelReviews } from "../src/content/media";

const pick = (list: { src: string; alt: string; width: number; height: number }[], files: string[]): s.ExperienceMedia[] =>
  files
    .map((f) => list.find((m) => m.src.endsWith(f)))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map(({ src, alt, width, height }) => ({ src, alt, width, height }));

const MEDIA: Record<string, s.ExperienceMedia[]> = {
  "music-production": pick(productionPhotos, ["prod-02.jpg", "prod-05.jpg", "prod-13.jpg", "prod-17.jpg", "prod-07.jpg", "prod-14.jpg", "prod-04.jpg", "prod-21.jpg"]),
  "dj-session": pick(djPhotos, ["dj-01.jpg", "dj-04.jpg", "dj-06.jpg", "dj-03.jpg", "dj-10.jpg", "dj-14.jpg", "dj-08.jpg", "dj-05.jpg"]),
  "sound-meditation": pick(meditationStills, ["meditation-still-1.jpg", "meditation-still-2.jpg", "meditation-still-3.jpg"]),
};

const DEMO = process.argv.includes("--demo");

const everyDay = (start: string, end: string): s.WeeklySchedule =>
  Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ start, end }]]));

/** A flat fee per extra hour on top of the 2-hour per-person price. */
const withExtraHours = (priceCents: number, hourCents = 15000): s.DurationOption[] => [
  { minutes: 120, priceCents },
  { minutes: 180, priceCents, flatCents: hourCents },
  { minutes: 240, priceCents, flatCents: hourCents * 2 },
];

const ON_TIME = "Please arrive on time. Sessions are scheduled and reserved in advance, so we can't guarantee extra time for late arrivals";

const EXPERIENCES: (typeof s.experiences.$inferInsert)[] = [
  {
    slug: "music-production",
    name: "Music Production Experience",
    shortName: "Music production",
    tagline: "",
    summary:
      "Two hours in a historic East Village recording studio. Build a beat from scratch, record your own vocals and leave with the music you made.",
    description:
      "Buzz in, head upstairs and step into the room where Jay Critch, Ron Suno, Ruben Blades and Making Movies have recorded. Alex gives you a tour of the studio, then hands you the controls. You'll pick sounds, build a beat from nothing, step into the vocal booth and learn the tricks producers use on real records. No experience needed. Most guests have never made music before.",
    theme: "production",
    highlights: [
      "Tour a historic East Village studio",
      "Build a beat from scratch",
      "Record your own vocals in the booth",
      "Learn the tricks producers use on real records",
      "Leave with your music",
    ],
    includes: ["All studio gear and software", "A bounced audio file of the music you create", "Pictures from your experience"],
    goodToKnow: ["Ages 10 and up", "Shared session, up to 15 guests", "Extra hours are $150 per hour", ON_TIME, "Sessions in English or Spanish"],
    media: [],
    pricingMode: "per_person",
    durationOptions: withExtraHours(15000),
    minGuests: 1,
    maxGuests: 15,
    minAge: 10,
    schedule: everyDay("10:00", "22:00"),
    slotStepMinutes: 120,
    leadTimeHours: 12,
    cancellationHours: 24,
    locationArea: "East Village, Manhattan",
    address: "602 East 14th Street, New York, NY 10009",
    arrivalInstructions: "Press the buzzer when you arrive and we'll bring you upstairs. Please arrive on time.",
    airbnbUrl: "https://www.airbnb.com/experiences/1326396",
    isPlaceholder: false,
    sortOrder: 1,
  },
  {
    slug: "dj-session",
    name: "Learn to DJ Experience",
    shortName: "Learn to DJ",
    tagline: "",
    summary:
      "Get behind pro Pioneer decks in a Brooklyn studio. Learn how DJs blend two songs into one, then record a mix of your own to take home.",
    description:
      "Club-standard Pioneer CDJs and mixer and a proper sound system. Alex walks you through how DJs line up two songs so they sound like one: beatmatching, EQ, cutting and dropping on cue. Each participant brings 5 songs, and by the end you'll record a mix of your own.",
    theme: "dj",
    highlights: [
      "Pro Pioneer CDJs and club mixer",
      "Learn to beatmatch by ear",
      "Blend, cut and drop on cue",
      "Record your own mix with the 5 songs you bring",
    ],
    includes: ["All DJ gear and headphones", "A recording of the mix you create"],
    goodToKnow: ["Each participant prepares 5 songs for their recorded mix", "Shared session, up to 5 guests", "Extra hours are $150 per hour", ON_TIME, "Sessions in English or Spanish"],
    media: [],
    pricingMode: "per_person",
    durationOptions: withExtraHours(13500),
    minGuests: 1,
    maxGuests: 5,
    schedule: everyDay("10:00", "22:00"),
    slotStepMinutes: 120,
    leadTimeHours: 12,
    cancellationHours: 24,
    locationArea: "Bushwick, Brooklyn",
    address: "96 Knickerbocker Ave, Brooklyn, NY 11237",
    arrivalInstructions: "Please arrive on time, with your 5 songs ready.",
    airbnbUrl: "https://www.airbnb.com/experiences/6943916",
    isPlaceholder: false,
    sortOrder: 2,
  },
  {
    slug: "sound-meditation",
    name: "Meditation Experience",
    shortName: "Meditation",
    tagline: "",
    summary:
      "An immersive, guided sound meditation: crystal bowls, live soundscapes and projected visuals while you lie back and let the city fall away.",
    description:
      "Settle in, close your eyes and let a live, slowly shifting soundscape do the work. Crystal singing bowls, deep tones and immersive visuals fill the room while you rest. No meditation experience needed and nothing to get right. Bookings start at 6 guests, and a session holds up to 15.",
    theme: "wellness",
    highlights: ["Live crystal bowls and soundscapes", "Immersive projected visuals", "A guided breath to land in the room", "Original music composed for the experience"],
    includes: ["Mats and cushions", "Live sound", "Access to the full meditation recording", "The original musical compositions created for the experience"],
    goodToKnow: ["Minimum booking of 6 guests", "Up to 15 guests per session", "Wear comfortable clothes", ON_TIME],
    media: [],
    pricingMode: "per_person",
    durationOptions: [{ minutes: 120, priceCents: 8500 }],
    minGuests: 6,
    maxGuests: 15,
    schedule: everyDay("10:00", "22:00"),
    slotStepMinutes: 120,
    leadTimeHours: 48,
    cancellationHours: 72,
    locationArea: "Dumbo, Brooklyn",
    address: "45 Main Street, Brooklyn, NY 11201",
    arrivalInstructions: "Please arrive on time so the session can start together.",
    isPlaceholder: false,
    sortOrder: 3,
  },
];

/** Real community events from the Meetup group (meetup.com/raw-planet-nyc-electronic-music-producers). */
const EVENTS: (typeof s.events.$inferInsert)[] = [
  {
    slug: "electronic-music-production-idea-to-track-2026-11-25",
    title: "Electronic Music Production: From Idea to Track",
    summary: "A free, beginner-friendly evening at Mercy Sound Studios on turning a musical idea into an electronic track.",
    description:
      "Join us at Mercy Sound Studios for an interactive gathering about electronic music production. We'll walk through how an idea becomes a track: creative workflows, arrangement, sound selection, synthesizers, drum programming and basic production techniques.\n\nShare your own music for feedback, try the synthesizers and drum machines, and meet other producers in New York. No experience required. Free admission with RSVP.",
    startAt: fromLocal("2026-11-25", "18:30"),
    endAt: fromLocal("2026-11-25", "20:30"),
    venue: "Mercy Sound Studios",
    address: "602 East 14th Street, New York, NY 10009",
    meetupUrl: "https://www.meetup.com/raw-planet-nyc-electronic-music-producers/events/317391139/",
    rsvpEnabled: true,
    status: "published",
  },
];

const REVIEWS: (Omit<typeof s.reviews.$inferInsert, "experienceId"> & { exp?: string })[] = [
  { exp: "music-production", name: "Krysten", location: "Lewisville, NC", rating: 5, featured: true, body: "This was the BEST NYC experience we've ever had! Cristian has that unique ability to make you feel comfortable right away (which is important when you are in a creative space!). He was knowledgeable, accommodating and FUN! ... the best NYC souvenir we could dream of- a recorded track that we created!" },
  { exp: "music-production", name: "Joseph", location: "New York, NY", rating: 5, featured: true, body: "Alex was so great and a total professional. We live in the city and did this as a birthday celebration and we would definitely do it again!" },
  { exp: "music-production", name: "Juniper", location: "Berkeley, CA", rating: 5, featured: true, body: "we came as a group of colleagues who knew nothing about music production and left with a little song we created ... our host made what might have been an intimidating experience fun, creative, and approachable! I'll listen to music a little differently after this." },
  { exp: "music-production", name: "Jessica", location: "Danville, CA", rating: 5, body: "Our group really enjoyed this session with Alex! He was awesome and we came away with a really fun track." },
  { exp: "music-production", name: "Jason", location: "Edmonton, Canada", rating: 5, body: "Genuinely one of the best experiences ive had. Top 3 for sure. Cristian was an amazing host" },
  { exp: "music-production", name: "Shania", location: "New York, NY", rating: 5, body: "My fiancé and I had a wonderful time making a song of our own." },
];

async function main() {
  const db = await createDb();

  const expIds: Record<string, string> = {};
  for (const e of EXPERIENCES) {
    const [existing] = await db.select().from(s.experiences).where(eq(s.experiences.slug, e.slug)).limit(1);
    if (existing) {
      expIds[e.slug] = existing.id;
      if (existing.media.length === 0 && MEDIA[e.slug]?.length) {
        await db.update(s.experiences).set({ media: MEDIA[e.slug] }).where(eq(s.experiences.id, existing.id));
      }
      console.log(`· experience ${e.slug} exists (kept admin edits)`);
    } else {
      const [row] = await db.insert(s.experiences).values({ ...e, media: MEDIA[e.slug] ?? [] }).returning();
      expIds[e.slug] = row.id;
      console.log(`+ experience ${e.slug}`);
    }
  }

  for (const ev of EVENTS) {
    const added = await db.insert(s.events).values(ev).onConflictDoNothing({ target: s.events.slug }).returning();
    if (added.length) console.log(`+ event ${ev.slug}`);
  }

  const addonCount = (await db.select().from(s.addons)).length;
  if (addonCount === 0) {
    await db.insert(s.addons).values([
      { name: "Session video clip", description: "A short edited video of your session to share.", priceCents: 7500, pricing: "per_booking", active: false, sortOrder: 1 },
      { name: "Stems + extended mixdown", description: "Every track of your song, plus a polished mix, delivered within a week.", priceCents: 5000, pricing: "per_booking", active: false, experienceId: expIds["music-production"], sortOrder: 2 },
      { name: "Celebration bubbly", description: "A bottle waiting on ice for birthdays and anniversaries.", priceCents: 4000, pricing: "per_booking", active: false, sortOrder: 3 },
    ]);
    console.log("+ add-ons (disabled — enable in Admin → Experiences)");
  }

  const reviewCount = (await db.select().from(s.reviews)).length;
  if (reviewCount === 0) {
    // Reviews transcribed from the Airbnb listing + the on-screen reviews in Alex's promo reel.
    // Skipped: one reel review that is partly hidden behind other cards in every frame.
    const fromReel = reelReviews
      .filter((r) => !/…/.test(r.text.slice(0, -1)))
      .map((r) => ({
        exp: "music-production",
        name: r.name,
        location: r.name === "Uta" ? null : r.location,
        rating: 5,
        body: r.text,
        reviewDate: parseMonth(r.date),
      }));
    const all = [...REVIEWS, ...fromReel];
    await db.insert(s.reviews).values(
      all.map(({ exp, ...r }) => ({ ...r, experienceId: exp ? expIds[exp] : null, source: "airbnb" as const, status: "published" as const })),
    );
    console.log(`+ ${all.length} Airbnb reviews`);
  }

  if (DEMO) await seedDemo(db, expIds);
  console.log("Seed complete.");
  process.exit(0);
}

function parseMonth(label: string): Date | null {
  const m = label.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const d = new Date(`${m[1]} 15, ${m[2]} 12:00 UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function seedDemo(db: Awaited<ReturnType<typeof createDb>>, expIds: Record<string, string>) {
  const existing = await db.select().from(s.bookings).limit(1);
  if (existing.length) {
    console.log("· demo data already present");
    return;
  }
  const today = todayKey();
  const people = [
    ["Maya Chen", "maya@example.com"],
    ["Daniel Ortiz", "daniel@example.com"],
    ["Priya Nair", "priya@example.com"],
    ["Tom Becker", "tom@example.com"],
    ["Lucía Romero", "lucia@example.com"],
    ["Sam Okafor", "sam@example.com"],
  ];
  const plan: [number, string, string, number, number, s.BookingStatus, s.BookingSource][] = [
    [-9, "12:00", "music-production", 120, 2, "completed", "direct"],
    [-6, "18:00", "dj-session", 120, 3, "completed", "airbnb"],
    [-2, "14:00", "music-production", 180, 4, "completed", "direct"],
    [1, "12:00", "music-production", 120, 2, "confirmed", "direct"],
    [1, "18:00", "dj-session", 120, 1, "confirmed", "direct"],
    [3, "16:00", "music-production", 120, 3, "confirmed", "airbnb"],
    [5, "20:00", "dj-session", 120, 4, "confirmed", "direct"],
    [8, "14:00", "sound-meditation", 120, 12, "confirmed", "manual"],
    [4, "10:00", "music-production", 120, 2, "cancelled", "direct"],
  ];
  for (let i = 0; i < plan.length; i++) {
    const [dayOffset, time, slug, minutes, guests, status, source] = plan[i];
    const [name, email] = people[i % people.length];
    const [c] = await db
      .insert(s.customers)
      .values({ name, email })
      .onConflictDoUpdate({ target: s.customers.email, set: { name } })
      .returning();
    const [exp] = await db.select().from(s.experiences).where(eq(s.experiences.id, expIds[slug]));
    const unit = exp.durationOptions.find((d) => d.minutes === minutes)?.priceCents ?? exp.durationOptions[0].priceCents;
    const total = unit * guests;
    const start = fromLocal(addDaysKey(today, dayOffset), time);
    const [b] = await db
      .insert(s.bookings)
      .values({
        code: newBookingCode(),
        experienceId: exp.id,
        customerId: c.id,
        status,
        paymentStatus: status === "cancelled" ? "refunded" : "paid",
        source,
        startAt: start,
        endAt: new Date(start.getTime() + minutes * 60_000),
        durationMinutes: minutes,
        guests,
        resourceGroup: exp.resourceGroup,
        contactName: name,
        contactEmail: email,
        subtotalCents: total,
        totalCents: total,
        amountPaidCents: total,
        amountRefundedCents: status === "cancelled" ? total : 0,
        manageToken: newToken(),
        confirmedAt: new Date(),
        occasion: i % 3 === 0 ? "Birthday" : null,
        deliverableStatus: status === "completed" && slug === "music-production" ? (i === 0 ? "delivered" : "in_progress") : "none",
        cancelledAt: status === "cancelled" ? new Date() : null,
        cancelledBy: status === "cancelled" ? "customer" : null,
      })
      .returning();
    await db.insert(s.bookingEvents).values([
      { bookingId: b.id, type: "created", message: "Booking started — waiting for payment", actor: "customer" },
      { bookingId: b.id, type: "confirmed", message: "Payment received — booking confirmed", public: true },
    ]);
  }

  // Sample community meetup series, every three weeks like the real group (edit or delete in admin)
  const series = newToken().slice(0, 8);
  for (let k = 0; k < 3; k++) {
    const date = addDaysKey(today, 27 + k * 21);
    await db.insert(s.events).values({
      slug: `producers-meetup-${date}`,
      title: "Raw Planet Producers Meetup",
      summary: "Bring a beat, a laptop or just your ears. Production talk, live demos and track feedback.",
      description:
        "Our community night for electronic music producers, DJs and musicians of every level. Production discussions, live demos of synths and hardware, track feedback and good people. Free with RSVP.",
      startAt: fromLocal(date, "18:30"),
      endAt: fromLocal(date, "20:30"),
      venue: "Mercy Sound Studios",
      address: "602 East 14th Street, New York, NY 10009",
      meetupUrl: "https://www.meetup.com/raw-planet-nyc-electronic-music-producers/",
      rsvpEnabled: true,
      capacity: 25,
      seriesId: series,
      status: "published",
    });
  }
  await db.insert(s.inquiries).values([
    { kind: "corporate", name: "Ana Ruiz", email: "ana@example.com", groupSize: 14, preferredDate: addDaysKey(today, 20), message: "Team offsite for our design team. Could we do the meditation experience followed by drinks?" },
    { kind: "group", name: "Chris P.", email: "chris@example.com", groupSize: 8, message: "Bachelorette party, 8 of us, want to make a song for the bride!" },
  ]);
  await db.insert(s.promoCodes).values({ code: "WELCOME10", description: "10% off your first session", kind: "percent", value: 10 });
  await db.insert(s.giftCards).values({
    code: "RAW-DEMO-GIFT-CARD",
    initialCents: 30000,
    balanceCents: 30000,
    status: "active",
    purchaserName: "Demo",
    purchaserEmail: "demo@example.com",
    recipientName: "Friend",
    issuedByAdmin: true,
  });
  console.log("+ demo bookings, events, inquiries, WELCOME10 promo, RAW-DEMO-GIFT-CARD");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
