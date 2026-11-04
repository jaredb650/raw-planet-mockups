# Raw Planet Experiences — architecture

Direct-booking platform for Raw Planet Experiences (music production, DJ and
sound-meditation sessions in NYC). Next.js 16 (App Router, **Cache Components
off**: classic dynamic rendering), TypeScript, Drizzle ORM on Postgres, Stripe,
Cal.com, Resend.

## One calendar, no double bookings

```
 Airbnb Experiences ⇄ (native 2-way sync) ⇄ Google Calendar ⇄ Cal.com ⇄ this site
 Viator ── manual block / admin "Block time" (or Bókun channel manager later)
```

- Cal.com is connected to Alex's Google Calendar: "check for conflicts" + "add events to".
- Airbnb Experiences is connected to the same Google Calendar (Airbnb → Calendar → Connect).
  Airbnb bookings appear on Google → Cal.com stops offering those times.
  Our bookings are written to Google by Cal.com → Airbnb blocks those times.
- The site's own availability engine (`src/lib/booking/availability.ts`) also
  subtracts local bookings, live checkout holds, manual blocks and imported iCal
  feeds, then intersects with Cal.com's slots when Cal.com is configured.
- Race safety: every booking write takes a Postgres advisory lock per resource
  group (`resourceGroup`, default `alex` = everything Alex hosts) and re-checks
  the slot inside the transaction. Cal.com's slot reservation is taken before
  sending the guest to Stripe.

## Booking lifecycle (`src/lib/booking/service.ts`)

`createBooking` → `pending_payment` (30-min hold, Stripe Checkout session) →
Stripe webhook → `fulfillBooking` → `confirmed` (Cal.com booking created,
emails sent) → `completed` / `no_show` (admin) — or `cancelBooking` /
`rescheduleBooking` (customer self-serve within policy, or admin anytime).
Abandoned checkouts → `expired` (cron + Stripe `checkout.session.expired`).

**All state changes go through the service.** Routes/actions validate input
(zod), call the service, and render. Never update `bookings` directly elsewhere.

## Local development with no keys

| Integration | Not configured → |
|---|---|
| `DATABASE_URL` | Embedded PGlite at `.data/pglite` (auto-migrated). Single process only — don't run scripts while `next dev` is running. |
| `STRIPE_SECRET_KEY` | `/checkout/test/[kind]/[id]` test-payment page |
| `CALCOM_API_KEY` | Built-in availability only |
| `RESEND_API_KEY` | Emails recorded in `email_log` (Admin → Emails shows them) |

`npm run db:reset` re-creates the local DB with demo data. Admin password in dev: `rawplanet`.

## Directory map

| Path | What |
|---|---|
| `src/lib/db/schema.ts` | Database schema (source of truth). `npm run db:generate` after edits. |
| `src/lib/booking/{pricing,availability,service}.ts` | Core domain logic |
| `src/lib/integrations/{stripe,calcom}.ts` | Thin API adapters (no-ops when unconfigured) |
| `src/lib/email/{send,notify}.ts`, `src/emails/` | Email sending + templates |
| `src/lib/queries/public.ts` | Read models for public pages |
| `src/lib/ics.ts` | iCalendar read/write |
| `src/app/(site)/` | Public website |
| `src/app/admin/` | Owner dashboard |
| `src/app/api/` | Webhooks, availability/quote/checkout APIs, cron |
| `src/content/` | Static copy (FAQ etc.) and media manifest |

## Conventions

- Money: integer cents. Time: UTC `Date` in DB; format with `src/lib/time.ts`
  helpers (always America/New_York). Never use `toLocaleString` without the TZ.
- Server-only modules import `"server-only"`. Client components get plain
  serialisable props (ISO strings, not Dates).
- Styling: plain CSS. Global tokens/components in `src/app/globals.css`;
  page/component styles in co-located `*.module.css`. Use tokens, not raw hex.
- Accessibility: real buttons/labels, visible focus, `aria-live` for async
  status, respects `prefers-reduced-motion`.
