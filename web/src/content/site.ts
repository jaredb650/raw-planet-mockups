/**
 * Static marketing copy for the public site. Facts here must match BRIEF.md
 * and the experience records in the database. Anything that depends on
 * admin-editable data (cancellation windows, group sizes, prices) is written
 * as a {{token}} and filled in from the DB at render time (see
 * src/components/site/faq.ts).
 */

export const SLOGANS = {
  hero: "Make it loud. Make it yours.",
  production: "Build the track you hear.",
  dj: "Play the room. No requests.",
  wellness: "Slow down to the beat.",
  booking: "Two hours to lose track.",
} as const;

/** Mood chooser copy, keyed by experience theme. */
export const MOODS: Record<string, { label: string; blurb: string; picked: string }> = {
  production: {
    label: "Make a beat",
    blurb: "Build a song from nothing and sing on it. Music production in the East Village.",
    picked: "Music production it is.",
  },
  dj: {
    label: "Mix like a DJ",
    blurb: "Two decks, one crowd of your friends, your first real blend.",
    picked: "A DJ session it is.",
  },
  wellness: {
    label: "Slow down and listen",
    blurb: "Lie back while live sound washes over the room. A guided sound meditation for groups.",
    picked: "Sound meditation it is.",
  },
};

export const WORRIES: { worry: string; answer: string }[] = [
  { worry: "I can't sing.", answer: "You don't have to. Talk, whisper, clap, or hand the mic to a friend. It's your session." },
  { worry: "I've never touched a music app.", answer: "Good. Alex starts from the very first button and goes at your pace." },
  { worry: "I'll feel awkward in a real studio.", answer: "Sessions are private. Just you, your people, and someone whose whole job is making it easy." },
  { worry: "I'm coming on my own.", answer: "Solo sessions are some of the best ones. You get Alex's full attention the whole time." },
  { worry: "My English isn't great.", answer: "Alex hosts in English and Spanish. Hablamos español." },
];

export const HOST = {
  name: "Alex Gentil",
  fullName: "Alexander “Cristian” Gentil",
  intro: "Hi, I'm Alex.",
  paragraphs: [
    "I'm a New York-based DJ, producer and audio engineer from Colombia, and I've been doing this professionally for more than ten years. Techno is where my heart is, but my days in the studio have run from electronic music to hip hop to salsa.",
    "Some guests know me as Cristian. Either works. What I love most is the moment someone hears their own idea come out of the big speakers for the first time. You bring the curiosity; I'll take care of the rest.",
  ],
  credits: [
    { label: "Worked with", value: "Jay Critch, Ron Suno, Ruben Blades, Making Movies" },
    { label: "Styles", value: "Electronic, techno, hip hop, salsa" },
    { label: "Sessions in", value: "English and Spanish" },
  ],
};

export type FaqCategory = "experiences" | "booking" | "payment" | "changes" | "groups" | "visit";

export const FAQ_CATEGORIES: { id: FaqCategory; title: string }[] = [
  { id: "experiences", title: "The experiences" },
  { id: "booking", title: "Booking" },
  { id: "payment", title: "Payment & gift cards" },
  { id: "changes", title: "Cancelling & rescheduling" },
  { id: "groups", title: "Groups & private events" },
  { id: "visit", title: "Your visit" },
];

export type FaqEntry = { q: string; a: string; category: FaqCategory; home?: boolean };

/**
 * Tokens available in answers:
 *   {{cancellation}}  "24 hours before for music production and DJ sessions, …"
 *   {{maxGuests}}     "up to 6 guests for music production and DJ sessions"
 */
export const FAQ: FaqEntry[] = [
  {
    category: "experiences",
    home: true,
    q: "Do I need any musical experience?",
    a: "None at all. Most guests have never made music before. Every session starts from zero and moves at your pace, and Alex does the technical heavy lifting so you can focus on the fun part.",
  },
  {
    category: "experiences",
    q: "“But I'm not musical.” Will I feel out of place?",
    a: "That's who most of our guests are. You don't have to sing, play an instrument or know any software. Sessions are private, so it's just you, your people and a host whose job is making it easy.",
  },
  {
    category: "experiences",
    home: true,
    q: "What do I take home?",
    a: "From the music production session you leave with the track you made together; we send you the file after your visit. DJ sessions are about the experience of playing your first set, and sound meditation is about how you feel walking out.",
  },
  {
    category: "experiences",
    q: "What's the difference between the three experiences?",
    a: "Music production: build a beat from scratch, record vocals and leave with your song, in a historic East Village studio. DJ session: learn to blend two songs on pro Pioneer decks and play a short set. Sound meditation: a guided sound bath with live sound and projected visuals, booked by groups of 10 or more.",
  },
  {
    category: "experiences",
    q: "Who hosts the sessions?",
    a: "Alex Gentil (some guests know him as Cristian), a New York-based DJ, producer and audio engineer with more than ten years of professional experience who has worked with artists like Jay Critch, Ron Suno, Ruben Blades and Making Movies.",
  },
  {
    category: "visit",
    home: true,
    q: "Are sessions in Spanish?",
    a: "Yes. Alex hosts in English and Spanish. Just let us know which you prefer when you book. Hablamos español.",
  },
  {
    category: "visit",
    home: true,
    q: "Can kids join?",
    a: "Music production is open to ages 10 and up, which makes it a favourite for birthdays. For the DJ session and sound meditation, get in touch before booking if anyone in your group is under 18.",
  },
  {
    category: "visit",
    q: "What should I bring?",
    a: "Nothing but yourself. All gear is included. If you like, bring a song you love, a voice memo of an idea or some lyrics on your phone. For DJ sessions you're welcome to bring a playlist. For sound meditation, wear comfortable clothes.",
  },
  {
    category: "visit",
    q: "Where are the studios?",
    a: "Each experience has its own room. Music production is in a historic studio in the East Village (NYC 10009). The exact address and arrival instructions are sent in your confirmation email. At the East Village studio, press the buzzer and Alex will bring you upstairs.",
  },
  {
    category: "visit",
    q: "Is the studio accessible?",
    a: "Access differs from studio to studio. Tell us what you need before you book (use the contact form or reply to any of our emails) and we'll give you an honest answer about whether the space works for you.",
  },
  {
    category: "booking",
    q: "How do I book?",
    a: "Pick an experience, choose a date and start time, tell us how many people are coming and pay securely online. You get a confirmation email straight away with everything you need, including a link to manage your booking.",
  },
  {
    category: "booking",
    home: true,
    q: "How many people can come?",
    a: "Sessions are private: just you and your group. You can book {{maxGuests}} online. For larger groups, parties or company events, send us a group request and we'll plan it with you.",
  },
  {
    category: "booking",
    q: "Can I book a longer session?",
    a: "Yes. Music production can be booked for 2, 3 or 4 hours. Longer sessions give you more time to finish and polish your track. You'll see every option and its price when you pick a time.",
  },
  {
    category: "booking",
    q: "Can I still book through Airbnb?",
    a: "You can, and our reviews there are where the 4.98 rating comes from. Booking here directly is the same session with the same host; it just comes straight to us.",
  },
  {
    category: "payment",
    home: true,
    q: "How do I pay?",
    a: "You pay online when you book. Payment is handled by Stripe, so your card details go straight to them and never touch our servers. Have a gift card or promo code? Enter it at checkout.",
  },
  {
    category: "payment",
    q: "Do you sell gift cards?",
    a: "Yes. Gift cards are sent by email, can be scheduled to arrive on a specific day, and work on any experience. If the session costs less than the card, the rest of the balance stays on the card for next time.",
  },
  {
    category: "payment",
    q: "Can I gift a specific session?",
    a: "Yes. When you book, you can mark the session as a gift and add the recipient's name and email. If you'd rather let them choose the date, buy a gift card instead.",
  },
  {
    category: "changes",
    home: true,
    q: "What if my plans change?",
    a: "Cancel for free up to {{cancellation}} and you get a full refund. You can also move your session to another open time yourself, up to the same cutoff, from the link in your confirmation email. No calls or emails needed.",
  },
  {
    category: "changes",
    q: "How do I cancel or reschedule?",
    a: "Open the “Manage your booking” link in your confirmation email. From there you can pick a new time or cancel. Lost the email? Use the Manage booking page and we'll send the link again.",
  },
  {
    category: "changes",
    q: "What if I'm running late?",
    a: "Reply to your confirmation email or message us as soon as you know. Sessions after yours may be booked, so we can't always extend, but we'll always make the most of the time you have.",
  },
  {
    category: "groups",
    q: "Do you host birthdays, bachelorettes and team outings?",
    a: "All the time. Birthdays, anniversaries, bachelorette parties, team outings and visiting friends are some of our favourite sessions. Small groups can book online; for bigger groups or anything custom, send a group request.",
  },
  {
    category: "groups",
    q: "How does sound meditation for groups work?",
    a: "Sound meditation is booked by groups of 10 or more, which makes it a great fit for team offsites, wellness days and celebrations. Send a group request with your date and headcount and we'll confirm the details.",
  },
  {
    category: "groups",
    q: "Do you do corporate events?",
    a: "Yes. Music production, DJ sessions and sound meditation all work for teams. Tell us your group size, dates and what you have in mind and we'll put together a plan and a quote.",
  },
];

/** "Perfect for" chips on each experience page, keyed by theme. */
export const PERFECT_FOR: Record<string, string[]> = {
  production: ["Birthdays (ages 10+)", "Couples and date nights", "Friends visiting NYC", "Teams who have never made music", "Curious solo visitors"],
  dj: ["A night out with friends", "Birthdays", "Anyone who has wanted to try the decks", "Music lovers with a playlist ready"],
  wellness: ["Corporate wellness days", "Offsites and retreats", "Birthday and celebration groups", "Yoga and wellness communities"],
};

/** What a session looks like, step by step, keyed by theme. Shown when the experience has no highlights of its own. */
export const SESSION_FLOW_TITLE: Record<string, string> = {
  production: "How the session goes",
  dj: "How the session goes",
  wellness: "How the evening flows",
};

/** FAQ questions surfaced on each experience page (matched by question text). */
export const EXPERIENCE_FAQ: Record<string, string[]> = {
  production: ["Do I need any musical experience?", "What do I take home?", "Can kids join?", "Can I book a longer session?", "What should I bring?"],
  dj: ["Do I need any musical experience?", "What do I take home?", "What should I bring?", "How many people can come?", "What if my plans change?"],
  wellness: ["How does sound meditation for groups work?", "Do you do corporate events?", "What should I bring?", "Are sessions in Spanish?", "Is the studio accessible?"],
};
