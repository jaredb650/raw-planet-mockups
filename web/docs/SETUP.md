# Going live: setup checklist

Everything runs without keys locally. In production you connect five services.
Budget about two hours. Do them in this order.

## 1. Hosting + database (Vercel + Neon)

1. Push this repo to GitHub, then **Vercel → Add New Project → import it**.
   Set **Root Directory = `web`**.
2. In the Vercel project: **Storage → Create → Neon Postgres**. It adds `DATABASE_URL`.
3. Add the environment variables from `.env.example`:
   - `NEXT_PUBLIC_SITE_URL` (e.g. `https://rawplanetexperiences.com`)
   - `ADMIN_PASSWORD` (long passphrase). Changing it later signs every device out of the admin, so use that if a phone is lost.
   - `AUTH_SECRET` (`openssl rand -base64 32`)
   - `CRON_SECRET` (`openssl rand -base64 32`)
4. Create the tables and load the experiences and reviews, once from your laptop:
   ```bash
   cd web
   DATABASE_URL="postgres://…" npm run db:migrate
   DATABASE_URL="postgres://…" npm run db:seed      # no --demo in production
   ```
   Run `npm run db:migrate` again after any future schema change.
5. Add your domain under **Settings → Domains**.
6. **Cron:** `vercel.json` runs `/api/cron/run` once a day, because Vercel's free
   (Hobby) plan rejects anything more frequent. For every 10 minutes, either use
   Pro and set `*/10 * * * *`, or create a free
   job at cron-job.org that calls
   `GET https://YOUR-DOMAIN/api/cron/run` every 10 minutes with header
   `Authorization: Bearer <CRON_SECRET>`.

## 2. Payments (Stripe)

1. Create or activate the Stripe account for Raw Planet Media LLC.
2. **Developers → API keys**: copy the secret key into `STRIPE_SECRET_KEY`.
   Use the test key first (`sk_test_…`), and the live key (`sk_live_…`) once you've tested.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-DOMAIN/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.expired`, `charge.refunded`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Settings → Branding**: logo and brick red `#B8482E`. Apple Pay, Google Pay and
   Link turn on automatically in Checkout.
5. Test with card `4242 4242 4242 4242`, any future date, any CVC.

## 3. One calendar for everything (Google + Cal.com + Airbnb)

This is what prevents double bookings across the website, Airbnb and Cal.com.

```
Airbnb Experiences ⇄ Google Calendar ⇄ Cal.com ⇄ rawplanetexperiences.com
```

**Cal.com**
1. Sign up at cal.com with the Google account whose calendar you use for work.
2. **Settings → Calendars → connect Google Calendar.**
   - Under **"Check for conflicts"**, tick your main calendar and any calendar Airbnb
     creates (it shows under "Other calendars" once Airbnb is connected; see below).
   - Under **"Add events to"**, choose your main calendar.
3. Create three **event types**: *Music Production*, *DJ Session*, *Sound Meditation*.
   - Music Production and DJ Session: durations 120, 180 and 240 minutes (Cal.com's
     "multiple durations" option). Sound Meditation: 90 minutes.
   - Availability: every day, 10:00–22:00 (America/New_York).
   - **No** payment app and **no** "requires confirmation" (the website takes payment).
   - Mark them **hidden**, so people book through the website rather than your Cal.com page.
4. Open each event type. The number in the URL (`/event-types/123456`) is its ID.
   Paste it into **Admin → Experiences → [experience] → Cal.com event type ID**.
5. **Settings → Developer → API keys** → create a key and paste it into `CALCOM_API_KEY`.
6. **Settings → Developer → Webhooks → New**:
   - URL: `https://YOUR-DOMAIN/api/webhooks/calcom`
   - Triggers: Booking created, Booking cancelled, Booking rescheduled
   - Secret: any random string; also put it in `CALCOM_WEBHOOK_SECRET`.

**Airbnb Experiences**
1. Airbnb → **Calendar → Connect calendars → Google** → choose the same Google account.
2. Airbnb bookings now appear on your Google Calendar, and Google events marked
   **Busy** block those times on Airbnb.
3. Website bookings are written to Google by Cal.com as **Busy** events, so they
   block Airbnb automatically.

**Viator** has no calendar sync for small operators. When a Viator booking comes in,
either:
- go to **Admin → Availability → Block time** (fastest), or
- log it under **Admin → Bookings → New** with source "Viator", so it also shows in your reports.

If Viator volume grows, a channel manager like Bókun connects Viator and Airbnb. Its
iCal export can be added under **Admin → Availability → Calendar feeds**.

**Check it works:** book a test session on the website, confirm it appears in Google
Calendar and is blocked on Airbnb, then cancel it from the manage link.

## 4. Email (Resend)

1. Sign up at resend.com, then **Domains → Add** `rawplanetexperiences.com`.
2. Add the DNS records it shows (SPF, DKIM) at your domain registrar and wait for "Verified".
3. **API Keys → Create**: put it in `RESEND_API_KEY`.
4. Set:
   - `EMAIL_FROM="Raw Planet Experiences <bookings@rawplanetexperiences.com>"`
   - `CONTACT_EMAIL` (where guest replies go)
   - `HOST_NOTIFICATION_EMAIL` (where your new-booking alerts go)
5. Make a test booking and check every email in **Admin → Emails**.

## 5. Spam protection (Cloudflare Turnstile)

A free, usually invisible check on the booking, gift card, waitlist, RSVP, contact and "find my booking" forms. Only suspicious visitors see a challenge.

1. Sign up at dash.cloudflare.com (free; the domain doesn't need to be on Cloudflare), then **Turnstile → Add widget**.
2. Hostnames: `rawplanetexperiences.com` (plus your `*.vercel.app` preview domain if you test there). Widget mode: **Managed**.
3. Put the **Site key** in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **Secret key** in `TURNSTILE_SECRET_KEY`, then redeploy (the site key is baked in at build time).
4. Check **Admin → Settings** shows "Spam protection" as on, then make a test booking.

## 6. Final checks in the admin

- **Admin → Settings**: every integration card is green.
- **Admin → Experiences**: confirm prices, durations, the private address and arrival
  instructions. Untick "details to confirm" once the DJ and meditation details are final.
- **Admin → Settings → Calendar feed**: subscribe to the private feed URL on your phone
  to see all bookings with guest details.
- **Community:** set `MEETUP_GROUP_URL`, then add the biweekly meetups under
  **Admin → Events** ("Repeat every 2 weeks").
- Make one real booking with your own card on live keys, then cancel it from the
  manage link in the confirmation email. That proves payment, calendar sync, emails
  and automatic refunds end to end.
