# Automations: emails, scheduled jobs, calendar feeds

Everything here runs without any setup in local dev: emails are recorded in
`email_log` (Admin → Emails) until `RESEND_API_KEY` is set, and the cron
endpoint runs without a secret.

## Guest emails

Every guest email is branded (cocoa header, experience accent stripe, a note
from Alex), sent in **English or Spanish** (the booking's language, or the
customer's saved language), and has a plain-text part. Preview them all at
`/api/dev/emails/index` (dev, or signed in as admin in production).

| Email | When | Notes |
|---|---|---|
| Booking confirmation | Payment confirmed (or manual booking with "send confirmation") | Full details, address + map link once Alex enters a real address, Google Calendar button, `.ics` invite attached, price breakdown, free-cancellation deadline in NY time, manage link |
| Gift booking (recipient) | Same moment, if the gift has a recipient email | The purchaser's message, details and invite; **no manage link** (only the purchaser can cancel/refund) |
| Rescheduled | Guest or admin moves a booking | Old time struck through, updated `.ics` (same UID, higher SEQUENCE, so calendars update the existing event) |
| Cancelled | Guest or admin cancels | Exact refund to card and/or gift card, or why there was none; cancelling `.ics` |
| Reminder | 24h before (skipped if booked less than 20h ahead) | Address, entry instructions, what to bring, Alex's phone/WhatsApp (Settings `hostPhone`, `hostWhatsapp`). Goes to the gift recipient when there is one |
| Thank-you + review ask | 3h after the session, between 9am and 8pm NY, within 7 days | Production: "your track is on its way" if not delivered yet; Instagram tag; gift card + rebook links |
| Review reminder | 4+ days after the thank-you, once, only if no review yet, within 21 days | "Last time we'll ask" |
| Track ready | Admin marks the deliverable delivered with a URL | Download button; purchaser of a gift gets a copy |
| Slot conflict | Two people paid for the same time (race) | Apology + full refund + "pick another time" deep link |
| Abandoned checkout | 45 min – 24h after a hold expired, session still 24h+ away, they haven't rebooked, they didn't cancel it themselves | Once only |
| Gift card receipt | Gift card paid / issued | The card (amount + code) and how to use it; says when the recipient gets it |
| Gift card (recipient) | Immediately, or at 9am NY on the chosen delivery date (cron) | Purchaser's message, card, "Choose my session" |
| Inquiry auto-reply | Inquiry form submitted | "Alex replies within a day", echo of their message, FAQ link |
| Waitlist opening | A slot on their requested day frees up (cancel/reschedule) | Deep link to that date |
| Event RSVP | RSVP to a community meetup (or RSVP cancelled) | `.ics` invite (event UID, so event changes update it), Meetup group link |
| Booking links | "Email me my booking links" on /manage | Only sent if that address has bookings (never a spam relay) |

**Never emailed automatically:** Airbnb and Viator bookings (the platform
talks to those guests), and any address ending in `.invalid`.

**Duplicate protection:** the same template + recipient + booking + subject
is not sent twice within 2 minutes, and every scheduled email is claimed in
the database before sending, so overlapping cron runs can't double-send.
Failed sends are retried on the next run, up to 3 times.

## Host emails (to `HOST_NOTIFICATION_EMAIL`)

| Email | When |
|---|---|
| New booking / Cancelled / Moved | As it happens (new site and Cal.com bookings; guest-initiated cancels and moves). Reply-to is the guest, so Alex can just hit reply. Shows source, total paid, add-ons, promo, occasion, guest notes, refund, and any calendar sync warning |
| Inquiry | New inquiry, reply-to = the inquirer |
| Morning digest | Daily from 7am NY: today's and tomorrow's run sheet (time, guest, party size, phone, notes, flags like Birthday / Español / Returning guest / Unpaid), plus "needs you": new inquiries, undelivered tracks, calendar sync errors, broken feeds, unpaid upcoming bookings. Skipped on a completely empty day |
| Weekly report | Mondays from 7am NY: last week's revenue (same cash basis as Admin → Reports), sessions, studio booked share, repeat guests and notes, with a link to the full report. Skipped when nothing happened |

## Scheduled jobs (`/api/cron/run`)

One endpoint runs everything, in this order. `?job=reminders,followups` runs a subset.

| Job | What it does |
|---|---|
| `expireHolds` | Releases checkout holds that lapsed 5+ minutes ago |
| `syncFeeds` | Imports every active calendar feed into availability blocks |
| `giftCardDelivery` | Sends gift cards scheduled for today |
| `reminders` | Day-before reminders |
| `abandonedCheckouts` | One "still want it?" email |
| `followups` | Thank-you + review ask |
| `reviewNudges` | One review reminder |
| `hostDigest` | The morning digest (once per day, from 7am NY) |
| `weeklyReport` | Last Monday to Sunday for the host (once per week, from 7am NY on Monday; a missed Monday catches up on the next run) |
| `campaignQueue` | Sends the next batch of any campaign still going out, so a long list survives the 60-second limit |
| `winBack` | Off by default (Settings). One rebook email per guest per 180 days, to opted-in guests whose last session was 120+ days ago |

**Auth:** `Authorization: Bearer $CRON_SECRET`, or a signed-in admin, or local
dev with no `CRON_SECRET` set. A lease in `settings.cronLock` stops overlapping
runs; the last run is stored in `settings.lastCronRun`.

**Schedule:** `vercel.json` runs once a day, because Vercel's free Hobby plan
rejects anything more frequent. The jobs are built for every 10 minutes, so
either use Pro and set `*/10 * * * *`, or add a free external pinger (cron-job.org, UptimeRobot) that calls
`GET https://YOUR-DOMAIN/api/cron/run` every 10 minutes with the header
`Authorization: Bearer <CRON_SECRET>`. Or GitHub Actions:

```yaml
# .github/workflows/cron.yml
name: cron
on:
  schedule: [{ cron: "*/10 * * * *" }]
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://YOUR-DOMAIN/api/cron/run
```

Running it more often is harmless; every job is idempotent.

## One calendar, no double bookings

```
 Airbnb ⇄ Google Calendar ⇄ Cal.com ⇄ this site
                 │
                 └── secret iCal link ──► Admin → Availability → feeds ──► blocks (every 10 min)
 this site ──► /api/calendar/<token>.ics ──► (optional) subscribe in Google / Apple / phone
```

- **With Cal.com connected** (recommended): Cal.com checks Google for
  conflicts and writes our bookings into Google; Airbnb's native Google sync
  blocks those times on Airbnb and puts Airbnb bookings into Google.
- **Imported feeds** (Admin → Availability → Calendar feeds) work with or
  without Cal.com. Paste Google Calendar's *Settings → Integrate calendar →
  Secret address in iCal format*, Airbnb's calendar export link, or any iCal
  URL (`webcal://` is fine). Each sync mirrors the next 180 days of busy time
  into blocks. If a feed can't be fetched, its existing blocks are kept (a
  flaky feed never opens up booked time) and the error shows in admin and in
  the morning digest. Events that are our own bookings echoed back (same exact
  start/end as a live booking, or a UID we issued) are skipped. Free/
  "transparent" and cancelled events are ignored. Pausing a feed frees its
  times on the next sync; deleting it frees them at once.
  *Limitation:* repeating (RRULE) events aren't expanded. Booking platforms
  list each occurrence, but for a recurring personal event in Google, add a
  recurring block in admin too.
- **Export feed** (`getCalendarFeedUrl()` in admin): all confirmed bookings
  from every source plus published community events, with guest name, party
  size, phone and notes. The link is secret; "regenerate" kills the old one.
  When Cal.com is connected you don't need it in Google (Cal.com already
  writes bookings there); it's handy on a phone or as the fallback when
  Cal.com isn't set up. Google refreshes subscribed calendars only every few
  hours, so never rely on the export alone to prevent double booking.

## Code map

| Path | What |
|---|---|
| `src/emails/templates/*.tsx` | Templates (`fn(view) → {subject, element}`) |
| `src/emails/view.ts` | DB rows → template view models (address placeholder detection, price lines, links) |
| `src/emails/samples.ts` | Preview fixtures + registry for `/api/dev/emails/*` |
| `src/lib/email/notify.ts` | The only entry points the rest of the app calls |
| `src/lib/automation/rules.ts` | Pure "is it due?" timing rules (unit-tested) |
| `src/lib/automation/jobs.ts` | The cron jobs |
| `src/lib/feeds.ts` | Feed import (`syncCalendarFeeds`, `previewCalendarFeed`, `clearFeedBlocks`) |
| `src/lib/calendar-feed.ts` | Export feed token + builder |
| `tests/unit/{ics,automation-rules}.test.ts` | Tests |
