/**
 * Static marketing copy for the public site. Facts here must match BRIEF.md
 * and the experience records in the database. Anything that depends on
 * admin-editable data (cancellation windows, group sizes, prices, addresses)
 * is written as a {{token}} and filled in from the DB at render time (see
 * src/components/site/faq.ts).
 */

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

export type CoHost = {
  name: string;
  role?: string;
  bio: string;
  paragraphs?: string[];
  photo?: { src: string; alt: string; objectPosition?: string };
};

/**
 * Co-hosts who assist Alex, keyed by experience theme. `count` is how many
 * assist; `people` fills in as the client sends each photo and biography
 * (their cards appear on the About page as soon as they are listed here).
 */
export const COHOSTS: Record<string, { count: number; people: CoHost[] }> = {
  production: {
    count: 2,
    people: [
      {
        name: "Sidney Mills",
        role: "Producer, Engineer & Remixer",
        bio: "A seven-time Grammy-nominated British Jamaican musician and producer best known as the keyboardist and musical arranger of the roots reggae band Steel Pulse from 1988 to 2020 and among reggae’s most prominent musicians. Based in NYC since 1981, Sidney worked as a musician, producer, engineer, and owner of SPI Music Inc. (with Living Room Records, a vintage label subsidiary of SPI Music Inc.).",
        paragraphs: [
          "A seven-time Grammy-nominated British Jamaican musician and producer best known as the keyboardist and musical arranger of the roots reggae band Steel Pulse from 1988 to 2020 and among reggae’s most prominent musicians. Based in NYC since 1981, Sidney worked as a musician, producer, engineer, and owner of SPI Music Inc. (with Living Room Records, a vintage label subsidiary of SPI Music Inc.).",
          "He has recorded and toured the world with some of the top reggae artists such as Shabba Ranks, Maxie Priest, Judy Mowatt, Dennis Brown, Aswad, The Meditations, Eek-A-Mouse, Shaggy, Ziggy Marley, Augustus Pablo, Sister Carol, Beres Hammond, Tenor Saw, Cocoa Tea, Junior Reid, Frankie Paul, Mikey Dread, Mutabaruka, Big Mountain, Dollarman, Larry McDonald, Morgan Heritage, Glen Washington, Super Cat, Shinehead, Toots Hibbert, and Sly & Robbie.",
          "Sidney is a member of notable pioneers of hip-hop unit Boogie Down Productions (BDP), having produced, remixed, and engineered several of hip-hop’s most influential musical masterpieces. In addition, he’s collaborated with a diverse roster of artists from a wide range of genres such as Sting, KRS-One, Wyclef Jean, Smashing Pumpkins, Michael Stipe (R.E.M.), Ron Wood (The Rolling Stones), Kid Rock, The Neville Brothers, Queen Latifah, Garland Jeffreys, and Gwen Guthrie to name a few.",
          "Sidney also performed with Steel Pulse at the White House—at U.S. President Bill Clinton’s request—as the first reggae band to perform for a presidential inauguration. On the film side, Sidney composed and produced the music for the film Fly By Night, was the music supervisor for Jamaica Beat, and co-produced and performed on the Steel Pulse song Can’t Stand The Heat for the Spike Lee film Do The Right Thing.",
          "In recent years, Sidney has been active as a producer and session player on various projects and with developing artists such as JD Smoothe. He recently produced the new album by Worl-A-Girl and is also the producer and member of the up-and-coming Brooklyn reggae group SunDub.",
        ],
        photo: {
          src: "/media/host/sidney-mills.jpg",
          alt: "Sidney Mills smiling in a knit beanie and ribbed shirt inside a red-walled recording studio",
          objectPosition: "50% 25%",
        },
      },
      {
        name: "Daniel Fox",
        role: "Artist, Producer, DJ & Engineer",
        bio: "New York–based artist, producer, DJ, and engineer Daniel Fox has spent much of his life immersed in music, moving between the city’s underground electronic scene and its professional recording studios.",
        paragraphs: [
          "New York–based artist, producer, DJ, and engineer Daniel Fox has spent much of his life immersed in music, moving between the city’s underground electronic scene and its professional recording studios.",
          "Finding early success on SoundCloud as a teenager, Fox began performing at a young age, opening for The Chainsmokers at just 15 before becoming a presence in Manhattan’s downtown DJ scene.",
          "His passion for music eventually led him behind the console at Brooklyn’s renowned Strange Weather recording studio, where he worked alongside and learned from accomplished engineers, producers, and musicians. During his time there, he contributed to recordings spanning a wide range of genres, working with artists and labels of all sizes.",
          "Today, Fox is co-owner of Soundwork International, a New York production/mix studio, where he continues to work across recording, production, and mixing while developing his own artistic projects.",
          "Drawing on years spent on both sides of the studio glass, his work bridges the technical craft of record-making with the raw energy and spontaneity of underground dance music.",
        ],
        photo: {
          src: "/media/host/daniel-fox.jpg",
          alt: "Black-and-white studio portrait of Daniel Fox seated at an analog mixing console with outboard gear behind him",
          objectPosition: "55% 30%",
        },
      },
    ],
  },
  wellness: { count: 1, people: [] },
};

/** "Alex Gentil, Sidney Mills and Daniel Fox" or "Alex Gentil and one co-host" */
export function hostsLine(theme: string): string {
  const entry = COHOSTS[theme];
  const n = entry?.count ?? 0;
  if (!n) return HOST.name;
  if (entry.people.length === n) {
    const names = [HOST.name, ...entry.people.map((p) => p.name)];
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  return `${HOST.name} and ${n === 1 ? "one co-host" : n === 2 ? "two co-hosts" : `${n} co-hosts`}`;
}

/** Premium rate for a completely private session, keyed by theme. No entry = quoted on request. */
export const PRIVATE_SESSION_CENTS: Record<string, number> = {
  production: 65000,
  dj: 45000,
};

export type FaqCategory = "experiences" | "booking" | "payment" | "changes" | "groups" | "visit";

export const FAQ_CATEGORIES: { id: FaqCategory; title: string }[] = [
  { id: "experiences", title: "The experiences" },
  { id: "booking", title: "Booking" },
  { id: "payment", title: "Payment & gift cards" },
  { id: "changes", title: "Cancelling & rescheduling" },
  { id: "groups", title: "Private sessions & groups" },
  { id: "visit", title: "Your visit" },
];

export type FaqEntry = { q: string; a: string; category: FaqCategory; home?: boolean };

/**
 * Tokens available in answers:
 *   {{cancellation}}  "24 hours before for music production and learn to DJ, …"
 *   {{prices}}        "$150 per person for the Music Production Experience, …"
 *   {{capacity}}      "The Music Production Experience holds up to 15 guests, …"
 *   {{locations}}     "Music Production Experience: 602 East 14th Street, …"
 *   {{privateRates}}  "$650 for the Music Production Experience and …"
 */
export const FAQ: FaqEntry[] = [
  {
    category: "experiences",
    home: true,
    q: "Do I need any musical experience?",
    a: "None at all. Most guests have never made music before. Every session starts from zero and moves at your pace, and the hosts do the technical heavy lifting so you can focus on the fun part.",
  },
  {
    category: "experiences",
    home: true,
    q: "What do I take home?",
    a: "Music Production Experience: at the end of the session you receive a bounced audio file of the music you created, plus pictures from your experience. Learn to DJ Experience: you receive a recording of the mix you create during the session. Meditation Experience: you receive access to the full meditation recording and to the original musical compositions created for the experience.",
  },
  {
    category: "experiences",
    q: "What's the difference between the three experiences?",
    a: "Music Production Experience: build a beat from scratch, record vocals and leave with your music, in a historic East Village studio. Learn to DJ Experience: learn to blend songs on pro Pioneer decks and record a mix of your own. Meditation Experience: a guided sound meditation with live sound and projected visuals.",
  },
  {
    category: "experiences",
    home: true,
    q: "How long are the experiences?",
    a: "Every experience is 2 hours long. For the Music Production and Learn to DJ experiences you can add extra hours at $150 per hour when you pick your time. Extra hours aren't offered for the Meditation Experience.",
  },
  {
    category: "experiences",
    q: "Who hosts the sessions?",
    a: "Alex Gentil (some guests know him as Cristian), a New York-based DJ, producer and audio engineer with more than ten years of professional experience who has worked with artists like Jay Critch, Ron Suno, Ruben Blades and Making Movies. Two co-hosts (Sidney Mills and Daniel Fox) assist with the Music Production Experience and one co-host assists with the Meditation Experience.",
  },
  {
    category: "experiences",
    q: "What do I need to prepare for the Learn to DJ Experience?",
    a: "Each participant prepares 5 songs for their personal recorded mix. After you book, your confirmation email asks for each participant's contact details, ideally a phone number, so we can coordinate the songs with you before the experience.",
  },
  {
    category: "visit",
    home: true,
    q: "What if I'm running late?",
    a: "Please arrive on time. If you're running late, let us know as soon as you can. Sessions are scheduled and reserved in advance, so we can't guarantee extra time or extensions for late arrivals.",
  },
  {
    category: "visit",
    q: "Where are the experiences?",
    a: "{{locations}}. Arrival instructions are in your confirmation email.",
  },
  {
    category: "visit",
    home: true,
    q: "Are sessions in Spanish?",
    a: "Yes. Alex hosts in English and Spanish. Just let us know which you prefer when you book. Hablamos español.",
  },
  {
    category: "visit",
    q: "Can kids join?",
    a: "The Music Production Experience is open to ages 10 and up. For the Learn to DJ and Meditation experiences, get in touch before booking if anyone in your group is under 18.",
  },
  {
    category: "visit",
    q: "What should I bring?",
    a: "All gear is included. For the Learn to DJ Experience, each participant brings 5 songs for their recorded mix. For the Music Production Experience you're welcome to bring a song you love, a voice memo of an idea or some lyrics. For the Meditation Experience, wear comfortable clothes.",
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
    q: "How much does it cost?",
    a: "{{prices}}. Extra hours for the Music Production and Learn to DJ experiences are $150 per hour.",
  },
  {
    category: "booking",
    home: true,
    q: "How many people can come?",
    a: "All sessions are public: book for yourself or for your group, and you may share the session with other guests. {{capacity}}. If you'd like the room to yourselves, ask us about a private session.",
  },
  {
    category: "booking",
    q: "Can I still book through Airbnb?",
    a: "You can, and our reviews there are where the 4.98 rating comes from. Booking here directly is the same session with the same host; it just comes straight to us.",
  },
  {
    category: "payment",
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
    category: "groups",
    q: "Can I book a completely private session?",
    a: "Yes, at a premium rate: {{privateRates}}. For a private Meditation Experience, reach out and we'll put a quote together. For any private session, send us a request and we'll confirm the date and details with you.",
  },
  {
    category: "groups",
    q: "Do you host birthdays, bachelorettes and team outings?",
    a: "All the time. Groups can book a public session online, up to the session's capacity. For a private session or anything custom, send us a request.",
  },
  {
    category: "groups",
    q: "How does the Meditation Experience work for groups?",
    a: "The Meditation Experience has a minimum booking of 6 guests and holds up to 15. Book online, or send us a request for a private session or a larger group.",
  },
  {
    category: "groups",
    q: "Do you do corporate events?",
    a: "Yes. The Music Production, Learn to DJ and Meditation experiences all work for teams. Tell us your group size, dates and what you have in mind and we'll put together a plan and a quote.",
  },
];

/** "Perfect for" chips on each experience page, keyed by theme. */
export const PERFECT_FOR: Record<string, string[]> = {
  production: ["Birthdays (ages 10+)", "Couples and date nights", "Friends visiting NYC", "Teams who have never made music", "Curious solo visitors"],
  dj: ["A night out with friends", "Birthdays", "Anyone who has wanted to try the decks", "Music lovers with 5 songs ready"],
  wellness: ["Corporate wellness days", "Offsites and retreats", "Birthday and celebration groups", "Yoga and wellness communities"],
};

/** What a session looks like, step by step, keyed by theme. Shown when the experience has no highlights of its own. */
export const SESSION_FLOW_TITLE: Record<string, string> = {
  production: "How the session goes",
  dj: "How the session goes",
  wellness: "How the session flows",
};

/** FAQ questions surfaced on each experience page (matched by question text). */
export const EXPERIENCE_FAQ: Record<string, string[]> = {
  production: ["Do I need any musical experience?", "What do I take home?", "How long are the experiences?", "What if I'm running late?", "How many people can come?", "Can kids join?"],
  dj: ["What do I need to prepare for the Learn to DJ Experience?", "What do I take home?", "How long are the experiences?", "What if I'm running late?", "How many people can come?", "What if my plans change?"],
  wellness: ["What do I take home?", "How does the Meditation Experience work for groups?", "What if I'm running late?", "What should I bring?", "Are sessions in Spanish?", "Is the studio accessible?"],
};
