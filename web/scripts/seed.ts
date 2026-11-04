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

const EXPERIENCES: (typeof s.experiences.$inferInsert)[] = [
  {
    slug: "music-production",
    name: "Music Production Session",
    shortName: "Music production",
    tagline: "Build the track you hear.",
    summary:
      "Two hours in a historic East Village recording studio. Build a beat from scratch, record your own vocals and walk out with a track that's actually yours.",
    description:
      "Buzz in, head upstairs and step into the room where Jay Critch, Ron Suno, Ruben Blades and Making Movies have recorded. Alex gives you a tour of the studio, then hands you the controls. You'll pick sounds, build a beat from nothing, step into the vocal booth and learn the tricks producers use on real records. No experience needed — most guests have never made music before.",
    theme: "production",
    highlights: [
      "Tour a historic East Village studio",
      "Build a beat from scratch",
      "Record your own vocals in the booth",
      "Learn the tricks producers use on real records",
      "Leave with your track",
    ],
    includes: ["All studio gear and software", "A private session with Alex", "Your finished track, sent after your visit"],
    goodToKnow: ["Ages 10 and up", "Press the buzzer and Alex will bring you upstairs", "Sessions in English or Spanish"],
    media: [],
    pricingMode: "per_person",
    durationOptions: [
      { minutes: 120, priceCents: 15000 },
      { minutes: 180, priceCents: 21000 },
      { minutes: 240, priceCents: 27000 },
    ],
    minGuests: 1,
    maxGuests: 6,
    minAge: 10,
    schedule: everyDay("10:00", "22:00"),
    slotStepMinutes: 120,
    leadTimeHours: 12,
    cancellationHours: 24,
    locationArea: "East Village, NYC 10009",
    address: "East Village, New York, NY 10009 (exact address sent with your confirmation)",
    arrivalInstructions: "Press the buzzer when you arrive and Alex will bring you upstairs.",
    airbnbUrl: "https://www.airbnb.com/experiences/1326396",
    sortOrder: 1,
  },
  {
    slug: "dj-session",
    name: "DJ Session",
    shortName: "DJ session",
    tagline: "Play the room. No requests.",
    summary:
      "Get behind pro Pioneer decks in a private NYC studio. Learn how DJs blend two songs into one, then play your first short set.",
    description:
      "A private room with club-standard Pioneer CDJs and mixer, a proper sound system and nobody watching but your friends. Alex walks you through how DJs line up two songs so they sound like one — beatmatching, EQ, cutting and dropping on cue — and by the end you'll play a short set of your own.",
    theme: "dj",
    highlights: [
      "Pro Pioneer CDJs and club mixer",
      "Learn to beatmatch by ear",
      "Blend, cut and drop on cue",
      "Play a short set to close the session",
    ],
    includes: ["All DJ gear and headphones", "A private session with Alex", "Music library — or bring your own playlist"],
    goodToKnow: ["Sessions in English or Spanish", "Great for birthdays and groups of friends"],
    media: [],
    pricingMode: "per_person",
    durationOptions: [
      { minutes: 120, priceCents: 15000 },
      { minutes: 180, priceCents: 21000 },
      { minutes: 240, priceCents: 27000 },
    ],
    minGuests: 1,
    maxGuests: 6,
    schedule: everyDay("10:00", "22:00"),
    slotStepMinutes: 120,
    leadTimeHours: 12,
    cancellationHours: 24,
    locationArea: "Manhattan, NYC",
    address: "Manhattan, New York, NY (exact address sent with your confirmation)",
    arrivalInstructions: "Exact address and entry instructions are in your confirmation email.",
    airbnbUrl: "https://www.airbnb.com/experiences/6943916",
    isPlaceholder: true,
    sortOrder: 2,
  },
  {
    slug: "sound-meditation",
    name: "Sound Meditation",
    shortName: "Sound meditation",
    tagline: "Slow down to the beat.",
    summary:
      "An immersive, guided sound bath for groups: crystal bowls, live soundscapes and projected visuals while you lie back and let the city fall away.",
    description:
      "Settle in, close your eyes and let a live, slowly shifting soundscape do the work. Crystal singing bowls, deep tones and immersive visuals fill the room while you rest. No meditation experience needed and nothing to get right. Sessions are booked by groups of 10 or more — perfect for team offsites, wellness days and celebrations.",
    theme: "wellness",
    highlights: ["Live crystal bowls and soundscapes", "Immersive projected visuals", "A guided breath to land in the room", "Built for groups of 10+"],
    includes: ["Mats and cushions", "Live sound by Alex", "Tea and a slow return to the city"],
    goodToKnow: ["Group bookings only — minimum 10 guests", "Wear comfortable clothes"],
    media: [],
    pricingMode: "per_person",
    durationOptions: [{ minutes: 90, priceCents: 4500 }],
    minGuests: 10,
    maxGuests: 30,
    schedule: everyDay("10:00", "22:00"),
    slotStepMinutes: 120,
    leadTimeHours: 48,
    cancellationHours: 72,
    locationArea: "New York, NY",
    address: "Venue confirmed with your booking",
    arrivalInstructions: "Arrive 10 minutes early to settle in.",
    isPlaceholder: true,
    sortOrder: 3,
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
    [8, "14:00", "sound-meditation", 90, 12, "confirmed", "manual"],
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

  // Biweekly community meetup series (sample — edit or delete in admin)
  const series = newToken().slice(0, 8);
  for (let k = 0; k < 4; k++) {
    const date = addDaysKey(today, 6 + k * 14);
    await db.insert(s.events).values({
      slug: `producers-meetup-${date}`,
      title: "Raw Planet Producers Meetup",
      summary: "Bring a beat, a laptop or just your ears. Feedback circle, listening session and good people.",
      description:
        "Our biweekly community night for music makers of every level. We play works-in-progress on the big speakers, trade tips, and meet other people making music in New York. Free — RSVP so we know how many chairs to put out.",
      startAt: fromLocal(date, "19:00"),
      endAt: fromLocal(date, "21:30"),
      venue: "Raw Planet studio",
      address: "East Village, New York, NY",
      meetupUrl: "https://www.meetup.com/",
      rsvpEnabled: true,
      capacity: 25,
      seriesId: series,
      status: "published",
    });
  }
  await db.insert(s.inquiries).values([
    { kind: "corporate", name: "Ana Ruiz", email: "ana@example.com", groupSize: 14, preferredDate: addDaysKey(today, 20), message: "Team offsite for our design team — could we do the sound meditation followed by drinks?" },
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
