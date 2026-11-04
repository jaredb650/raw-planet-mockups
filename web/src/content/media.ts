/**
 * Media manifest for Raw Planet Experiences.
 *
 * All files live under web/public/media and are served from "/media/…".
 * Width/height are the real pixel dimensions of the exported files.
 *
 * Sources
 * - DJ: pro shoot at Academy Record Studios (originals BG1A####.jpg). `source` notes the original frame.
 * - Production: legacy Airbnb listing photos, numbering preserved 1:1
 *   (/media/production/prod-NN.jpg  <-  assets/airbnb/prod-NN.jpg|jpeg).
 *   The two "new" Drive photos are lower-resolution copies of legacy shots and were NOT exported separately:
 *     00C0C_acYBqMvdJli.jpg (1200x800) == prod-02 (Alex at the desk with three guests)
 *     01414_lAqJk5v8gdh.jpg (1200x800) == prod-05 (guest recording vocals in the booth)
 * - Host: host/18.jpg -> alex-dark.jpg, host/AlexGentil-Rawphonics.jpg -> alex-light.jpg
 * - Meditation stills/poster: frames grabbed from meditation/Final1080.mp4 (no photos exist yet).
 *
 * Tag "hero" marks the best lead image in each group.
 */

export type Orientation = "landscape" | "portrait" | "square";

export interface MediaItem {
  src: string;
  width: number;
  height: number;
  alt: string;
  orientation: Orientation;
  tags: string[];
  /** Original file this was exported from (for traceability). */
  source?: string;
}

export interface VideoItem extends MediaItem {
  poster: string;
  durationSec: number;
  hasAudio: boolean;
  /** Muted, short version meant for autoplay/loop backgrounds. */
  loop: boolean;
}

export interface ReelReview {
  name: string;
  location: string;
  date: string;
  text: string;
  source: "airbnb";
}

export const djPhotos: MediaItem[] = [
  {
    src: "/media/dj/dj-01.jpg",
    width: 2400,
    height: 1600,
    alt: "Alex throws a fist in the air and grins while a guest in a heart-print cap and headphones mixes on Pioneer DJ decks, black acoustic foam and blue LED light behind them",
    orientation: "landscape",
    tags: ["hero", "dj", "alex", "guest", "celebration", "decks"],
    source: "BG1A2996.jpg",
  },
  {
    src: "/media/dj/dj-02.jpg",
    width: 2400,
    height: 1601,
    alt: "Alex smiling in a black cap and white sleeveless top in front of the Academy Record Studios sign and diamond-pattern acoustic foam",
    orientation: "landscape",
    tags: ["dj", "alex", "portrait", "host"],
    source: "BG1A3003.jpg",
  },
  {
    src: "/media/dj/dj-03.jpg",
    width: 2400,
    height: 1600,
    alt: "Alex and three guests stand arm in arm behind the DJ booth, smiling at the camera over the CDJs and mixer",
    orientation: "landscape",
    tags: ["dj", "alex", "group", "posed", "celebration"],
    source: "BG1A3008.jpg",
  },
  {
    src: "/media/dj/dj-04.jpg",
    width: 2400,
    height: 1600,
    alt: "A guest in a leopard-print cap and headphones works the CDJ jog wheel as Alex watches over her shoulder",
    orientation: "landscape",
    tags: ["dj", "alex", "guest", "teaching", "headphones", "decks"],
    source: "BG1A2936.jpg",
  },
  {
    src: "/media/dj/dj-05.jpg",
    width: 2400,
    height: 1600,
    alt: "Three guests share a laugh beside the decks while Alex looks down at the mixer, purple LED light on the acoustic foam behind them",
    orientation: "landscape",
    tags: ["dj", "alex", "group", "laughing"],
    source: "BG1A2866.jpg",
  },
  {
    src: "/media/dj/dj-06.jpg",
    width: 2400,
    height: 1600,
    alt: "Close-up of a guest's ringed fingers turning knobs on an Allen & Heath Xone:96 mixer next to a Pioneer CDJ while Alex points to the next control",
    orientation: "landscape",
    tags: ["dj", "detail", "close-up", "hands", "mixer", "teaching"],
    source: "BG1A2964.jpg",
  },
  {
    src: "/media/dj/dj-07.jpg",
    width: 1600,
    height: 2400,
    alt: "Alex and a guest in a brown leather jacket reach for the mixer together, both focused on the knobs",
    orientation: "portrait",
    tags: ["dj", "alex", "guest", "teaching", "mixer"],
    source: "BG1A2890.jpg",
  },
  {
    src: "/media/dj/dj-08.jpg",
    width: 1600,
    height: 2400,
    alt: "A guest in a brown leather jacket holds headphones to one ear and adjusts the mixer, lost in the mix",
    orientation: "portrait",
    tags: ["dj", "guest", "headphones", "mixing"],
    source: "BG1A2921.jpg",
  },
  {
    src: "/media/dj/dj-09.jpg",
    width: 1600,
    height: 2400,
    alt: "Alex in a black cap and white sleeveless top smiling at the camera with his hands on the decks",
    orientation: "portrait",
    tags: ["dj", "alex", "portrait", "host"],
    source: "BG1A2741.jpg",
  },
  {
    src: "/media/dj/dj-10.jpg",
    width: 2400,
    height: 1600,
    alt: "A guest in a heart-print cap and headphones reaches across the CDJs while a friend and Alex look on, laughing",
    orientation: "landscape",
    tags: ["dj", "alex", "group", "guest", "headphones", "mixing"],
    source: "BG1A2868.jpg",
  },
  {
    src: "/media/dj/dj-11.jpg",
    width: 2400,
    height: 1600,
    alt: "Close-up of Alex's hand pulling a channel fader on the mixer beside a CDJ screen, a guest in a leather jacket at his side",
    orientation: "landscape",
    tags: ["dj", "detail", "close-up", "hands", "mixer"],
    source: "BG1A2900.jpg",
  },
  {
    src: "/media/dj/dj-12.jpg",
    width: 2400,
    height: 1600,
    alt: "Alex cues a track on a CDJ while two guests in caps, one wearing headphones, work the mixer beside him",
    orientation: "landscape",
    tags: ["dj", "alex", "group", "teaching", "headphones"],
    source: "BG1A2987.jpg",
  },
  {
    src: "/media/dj/dj-13.jpg",
    width: 1600,
    height: 2400,
    alt: "A guest in a brown leather jacket smiles with eyes closed, holding headphones to her ear against a teal-lit wall",
    orientation: "portrait",
    tags: ["dj", "guest", "headphones", "portrait"],
    source: "BG1A2919.jpg",
  },
  {
    src: "/media/dj/dj-14.jpg",
    width: 2400,
    height: 1600,
    alt: "Close-up of a hand tapping a glowing Pioneer CDJ touchscreen beside the mixer, cables and a guest's pink cube-print T-shirt in frame",
    orientation: "landscape",
    tags: ["dj", "detail", "close-up", "hands", "cdj"],
    source: "BG1A2999.jpg",
  },
  {
    src: "/media/dj/dj-15.jpg",
    width: 2400,
    height: 1600,
    alt: "Alex and a guest smile while holding up a vinyl record with an \"alchemy\" label in front of the DJ setup",
    orientation: "landscape",
    tags: ["dj", "alex", "guest", "vinyl", "posed"],
    source: "BG1A2763.jpg",
  },
  {
    src: "/media/dj/dj-16.jpg",
    width: 1600,
    height: 2400,
    alt: "Alex smiling behind the mixer with a pair of headphones resting on the decks, Academy Record Studios sign above",
    orientation: "portrait",
    tags: ["dj", "alex", "portrait", "decks"],
    source: "BG1A2798.jpg",
  },
];

export const productionPhotos: MediaItem[] = [
  {
    src: "/media/production/prod-01.jpg",
    width: 1333,
    height: 2000,
    alt: "Two guests relax on the leather couch in the control room, golden wood slats and red walls behind, mixing console in the foreground",
    orientation: "portrait",
    tags: ["production", "guests", "couch", "studio"],
    source: "assets/airbnb/prod-01.jpg",
  },
  {
    src: "/media/production/prod-02.jpg",
    width: 1440,
    height: 960,
    alt: "Alex in a black flat cap works a laptop and drum machines at the desk while three guests lean in to watch, golden wood slats behind",
    orientation: "landscape",
    tags: ["hero", "production", "alex", "group", "teaching", "desk"],
    source: "assets/airbnb/prod-02.jpg (also Drive 00C0C_acYBqMvdJli.jpg)",
  },
  {
    src: "/media/production/prod-03.jpg",
    width: 1333,
    height: 2000,
    alt: "Alex at the production desk surrounded by synths and drum machines while guests sit on the couch behind him",
    orientation: "portrait",
    tags: ["production", "alex", "group", "desk", "studio"],
    source: "assets/airbnb/prod-03.jpg",
  },
  {
    src: "/media/production/prod-04.jpg",
    width: 1440,
    height: 960,
    alt: "A curly-haired guest plays bass guitar on the leather couch while Alex chats with another guest over a laptop",
    orientation: "landscape",
    tags: ["production", "alex", "guests", "guitar", "couch"],
    source: "assets/airbnb/prod-04.jpg",
  },
  {
    src: "/media/production/prod-05.jpg",
    width: 1440,
    height: 960,
    alt: "A guest in headphones and a cap sings into a studio condenser microphone in the orange-walled vocal booth",
    orientation: "landscape",
    tags: ["production", "guest", "vocals", "booth", "microphone"],
    source: "assets/airbnb/prod-05.jpg (also Drive 01414_lAqJk5v8gdh.jpg)",
  },
  {
    src: "/media/production/prod-06.jpg",
    width: 1440,
    height: 960,
    alt: "Alex plays a drum machine at the desk as two guests stand behind him watching, vintage outboard gear and monitors around them",
    orientation: "landscape",
    tags: ["production", "alex", "group", "teaching", "desk"],
    source: "assets/airbnb/prod-06.jpg",
  },
  {
    src: "/media/production/prod-07.jpg",
    width: 1440,
    height: 960,
    alt: "Alex in a black hat and cardigan smiles at the camera from the desk, a keyboard, mixing console and big monitor behind him",
    orientation: "landscape",
    tags: ["production", "alex", "portrait", "host"],
    source: "assets/airbnb/prod-07.jpg",
  },
  {
    src: "/media/production/prod-08.jpg",
    width: 1440,
    height: 960,
    alt: "Alex talks with guests lounging on the leather couch and in desk chairs, the room lined with golden wood slats",
    orientation: "landscape",
    tags: ["production", "alex", "group", "couch"],
    source: "assets/airbnb/prod-08.jpg",
  },
  {
    src: "/media/production/prod-09.jpg",
    width: 1440,
    height: 960,
    alt: "Alex stands smiling in the middle of the control room while guests sit on the couch and at the gear",
    orientation: "landscape",
    tags: ["production", "alex", "group", "studio"],
    source: "assets/airbnb/prod-09.jpg",
  },
  {
    src: "/media/production/prod-10.jpg",
    width: 1333,
    height: 2000,
    alt: "Alex types on a laptop at the keyboard desk while a guest looks on beside the rack of outboard gear",
    orientation: "portrait",
    tags: ["production", "alex", "guest", "desk"],
    source: "assets/airbnb/prod-10.jpg",
  },
  {
    src: "/media/production/prod-11.jpg",
    width: 1333,
    height: 2000,
    alt: "A guest in a denim jacket and cap works on a laptop in a desk chair while Alex sits nearby on the couch",
    orientation: "portrait",
    tags: ["production", "guest", "laptop"],
    source: "assets/airbnb/prod-11.jpg",
  },
  {
    src: "/media/production/prod-12.jpg",
    width: 1333,
    height: 2000,
    alt: "A curly-haired guest in light-wash jeans plays a bass guitar on the leather couch",
    orientation: "portrait",
    tags: ["production", "guest", "guitar", "couch"],
    source: "assets/airbnb/prod-12.jpg",
  },
  {
    src: "/media/production/prod-13.jpg",
    width: 1440,
    height: 960,
    alt: "Close-up of a guest's hands programming a green-lit drum machine surrounded by vintage outboard gear",
    orientation: "landscape",
    tags: ["production", "detail", "close-up", "hands", "drum-machine"],
    source: "assets/airbnb/prod-13.jpg",
  },
  {
    src: "/media/production/prod-14.jpg",
    width: 1440,
    height: 960,
    alt: "Wide view of the control room: Alex at the keyboard, a guest on the couch, red walls and golden wood slats",
    orientation: "landscape",
    tags: ["production", "alex", "studio", "wide"],
    source: "assets/airbnb/prod-14.jpg",
  },
  {
    src: "/media/production/prod-15.jpg",
    width: 1440,
    height: 960,
    alt: "Alex leans over a guest seated at the keyboard and laptop, guiding him through a beat",
    orientation: "landscape",
    tags: ["production", "alex", "guest", "teaching", "keyboard"],
    source: "assets/airbnb/prod-15.jpg",
  },
  {
    src: "/media/production/prod-16.jpg",
    width: 1333,
    height: 2000,
    alt: "Alex works at the production desk lined with synths, drum machines, a keyboard and studio monitors",
    orientation: "portrait",
    tags: ["production", "alex", "desk", "studio"],
    source: "assets/airbnb/prod-16.jpg",
  },
  {
    src: "/media/production/prod-17.jpg",
    width: 1333,
    height: 2000,
    alt: "Alex crouches beside a guest in a navy sweater as they both work the drum machine at the desk",
    orientation: "portrait",
    tags: ["production", "alex", "guest", "teaching", "drum-machine"],
    source: "assets/airbnb/prod-17.jpg",
  },
  {
    src: "/media/production/prod-18.jpg",
    width: 1440,
    height: 1920,
    alt: "A producer in a black T-shirt adjusts the mixing console in front of a large screen and studio monitors in the orange control room",
    orientation: "portrait",
    tags: ["production", "console", "studio"],
    source: "assets/airbnb/prod-18.jpeg",
  },
  {
    src: "/media/production/prod-19.jpg",
    width: 1440,
    height: 1920,
    alt: "A man in a rust-colored bomber jacket sits in a chair in the control room, monitors and the mixing desk behind him",
    orientation: "portrait",
    tags: ["production", "portrait", "studio"],
    source: "assets/airbnb/prod-19.jpeg",
  },
  {
    src: "/media/production/prod-20.jpg",
    width: 1440,
    height: 1080,
    alt: "A guest in a tie-dye shirt plays the keyboard at the console while a friend in a patterned sweater watches",
    orientation: "landscape",
    tags: ["production", "guests", "keyboard", "console"],
    source: "assets/airbnb/prod-20.jpeg",
  },
  {
    src: "/media/production/prod-21.jpg",
    width: 1440,
    height: 810,
    alt: "A group of guests gathers behind a producer at the mixing console in the red and orange control room",
    orientation: "landscape",
    tags: ["production", "group", "console", "studio"],
    source: "assets/airbnb/prod-21.jpeg",
  },
  {
    src: "/media/production/prod-22.jpg",
    width: 1440,
    height: 1920,
    alt: "Three men pose together in a room washed in magenta and purple light",
    orientation: "portrait",
    tags: ["production", "group", "posed", "purple", "mood"],
    source: "assets/airbnb/prod-22.jpeg",
  },
  {
    src: "/media/production/prod-23.jpg",
    width: 1440,
    height: 960,
    alt: "Seen from behind, a producer works the vintage console in the orange-walled control room between tall studio monitors",
    orientation: "landscape",
    tags: ["production", "console", "studio", "wide"],
    source: "assets/airbnb/prod-23.jpeg",
  },
  {
    src: "/media/production/prod-24.jpg",
    width: 1440,
    height: 1920,
    alt: "Guests sit and listen on couches in a room lit deep blue and purple while a man stands talking near a keyboard",
    orientation: "portrait",
    tags: ["production", "group", "purple", "mood"],
    source: "assets/airbnb/prod-24.jpeg",
  },
];

export const hostPhotos: MediaItem[] = [
  {
    src: "/media/host/alex-light.jpg",
    width: 1600,
    height: 1067,
    alt: "Profile portrait of Alex Gentil in a dark leather jacket, gazing off to the side against a bright white background",
    orientation: "landscape",
    tags: ["hero", "host", "alex", "portrait", "light"],
    source: "host/AlexGentil-Rawphonics.jpg",
  },
  {
    src: "/media/host/alex-dark.jpg",
    width: 1066,
    height: 1600,
    alt: "Moody close-up portrait of Alex Gentil looking straight into the camera out of deep shadow",
    orientation: "portrait",
    tags: ["host", "alex", "portrait", "dark"],
    source: "host/18.jpg",
  },
];

export const meditationStills: MediaItem[] = [
  {
    src: "/media/video/meditation-still-1.jpg",
    width: 1080,
    height: 1920,
    alt: "A wall-sized forest-and-waterfall projection with glowing rings towers over a row of crystal singing bowls, plants and white flowers on the floor",
    orientation: "portrait",
    tags: ["hero", "meditation", "projection", "bowls"],
    source: "Final1080.mp4 @ 3.5s",
  },
  {
    src: "/media/video/meditation-still-2.jpg",
    width: 1080,
    height: 1920,
    alt: "Participants lie resting on mats in front of a glowing wall of light panels, potted plants along its base",
    orientation: "portrait",
    tags: ["meditation", "resting", "people"],
    source: "Final1080.mp4 @ 11s",
  },
  {
    src: "/media/video/meditation-still-3.jpg",
    width: 1080,
    height: 1920,
    alt: "A sound practitioner in headphones sits cross-legged at decks on the floor, framed by a huge forest projection with glowing rings",
    orientation: "portrait",
    tags: ["meditation", "practitioner", "projection"],
    source: "Final1080.mp4 @ 31s",
  },
];

export const videos: VideoItem[] = [
  {
    src: "/media/video/meditation.mp4",
    width: 720,
    height: 1280,
    alt: "Sound-bath reel: crystal singing bowls, forest projections and guests resting on mats in a loft space",
    orientation: "portrait",
    tags: ["meditation", "reel", "audio"],
    poster: "/media/video/meditation-poster.jpg",
    durationSec: 53,
    hasAudio: true,
    loop: false,
    source: "meditation/Final1080.mp4",
  },
  {
    src: "/media/video/meditation-loop.mp4",
    width: 720,
    height: 1280,
    alt: "Muted loop of forest projections, crystal bowls and people resting during a sound meditation",
    orientation: "portrait",
    tags: ["hero", "meditation", "loop", "background"],
    poster: "/media/video/meditation-poster.jpg",
    durationSec: 12,
    hasAudio: false,
    loop: true,
    source: "meditation/Final1080.mp4 2.72s-14.72s",
  },
  {
    src: "/media/video/production.mp4",
    width: 720,
    height: 1280,
    alt: "Music-production promo reel: guest reviews, Alex talking in the studio, studio b-roll and a closing \"book now\" card",
    orientation: "portrait",
    tags: ["production", "reel", "audio", "reviews"],
    poster: "/media/video/production-poster.jpg",
    durationSec: 24,
    hasAudio: true,
    loop: false,
    source: "production/prod-video.mp4",
  },
  {
    src: "/media/video/production-loop.mp4",
    width: 720,
    height: 1280,
    alt: "Muted loop of studio b-roll: console knobs, the orange control room, a vocal mic and hands on a Roland drum machine",
    orientation: "portrait",
    tags: ["hero", "production", "loop", "background"],
    poster: "/media/video/production-poster.jpg",
    durationSec: 12,
    hasAudio: false,
    loop: true,
    source: "production/prod-video.mp4 9.1s-21.1s",
  },
];

/**
 * Reviews shown on screen in the production reel (prod-video.mp4, 0-5s), transcribed verbatim
 * including the original typos ("passion passion", "thiw", "knowledgable", "friend !").
 * "…" marks text hidden behind other cards in the video. The Uta name/location/date are
 * motion-blurred in every frame and read with lower confidence.
 */
export const reelReviews: ReelReview[] = [
  {
    name: "Juan",
    location: "Caldwell, NJ",
    date: "February 2026",
    text: "Amazing experience! Made us feel like experts and very accommodating. Felt like if we were hanging out with a great friend ! Thank you!",
    source: "airbnb",
  },
  {
    name: "Quaison",
    location: "New York, NY",
    date: "January 2026",
    text: "This was so much fun. Do it!",
    source: "airbnb",
  },
  {
    name: "Moriah",
    location: "United States",
    date: "December 2025",
    text: "I booked this experience for my husband who has a passion passion and ear for music. He has always had a desire to explore music production and thiw was the perfect opportunity to do so. Alexander showed him his process of sampling, breaking down stems and building a beat.",
    source: "airbnb",
  },
  {
    name: "Paul",
    location: "Berlin, Germany",
    date: "2 weeks ago",
    text: "Alexander is super kind, very communicative and super knowledgable about music and producing! We came with a tiny little idea and left with a full remix! Really great experience and would totally repeat next time I am in NYC! Thanks!",
    source: "airbnb",
  },
  {
    name: "Melanie",
    location: "Boston, MA",
    date: "December 2025",
    text: "Very unique and fun experience! Definitely recommend to those interested in making and learning about music from a knowledgeable, friendly and skilled artist/producer! Don't delay booking... you will treasure the memories and music you make. Priceless! We'll be back for more!",
    source: "airbnb",
  },
  {
    name: "Uta",
    location: "New York, NY",
    date: "January 2026",
    text: "Zero plan, pure magic. We walked in with nothing but vibes, and Alex made an incredible song happen in one effortless, joyful session. His production is brilliant, his suggestions spot-on, and the vibe was so collaborative and fun. We left with a song…",
    source: "airbnb",
  },
  {
    name: "Anjani",
    location: "Dallas, TX",
    date: "November 2025",
    text: "It was a great experience our daughters went for a birthday session. Christian was … and made the entire experience feel effortless. The girls had an … Thank you for creating such a memorable and fun day …",
    source: "airbnb",
  },
];
