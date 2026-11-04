# Orchestrator handoff — Raw Planet direct-booking platform

Last updated: 2026-11-04 (before the VS Code restart). Read this first, then each
`docs/handoff/<area>.md` written by the four build agents.

## Goal (from the user)
The client, Alex Gentil (Raw Planet Experiences, NYC music production / DJ / sound
meditation), wants a direct-booking site in the **Open Door** mockup aesthetic
(`/mockups/3-open-door/index.html`) that is competitive with Airbnb Experiences:
- Stripe payments.
- Cal.com on the backend, with ONE Google Calendar shared by Airbnb, the site and Cal.com, so nothing double-books.
- Customer email automation.
- Order tracking.
- Easy schedule management for the owner.
- From the client's email: FAQ, reviews, community events/meetups (biweekly, linked to
  Meetup), easy booking, and video testimonials for meditation.

Keep going until it is genuinely competitive. Use subagents for parallel work.

## Inputs already gathered
- Client email: `~/Downloads/Website assets Rawplanet experiences.eml`.
- Drive folder downloaded to the scratchpad (`…/scratchpad/drive/raw`). It includes a
  developer brief PDF (`raw/docs/`) with:
  - **Palette:** brick #B8482E, ochre #E0A030 (production), orange #E8703A (DJ),
    green #8DB66F (wellness), powder #C9DCE3, cream #F7E7C6, olive #8A8B5C, cocoa #3A2212.
  - **Fonts:** Big Shoulders Display + DM Sans.
  - **Slogans:** "Make it loud. Make it yours." / "Play the room. No requests." /
    "Build the track you hear." / "Slow down to the beat." / "Two hours to lose track."
  - **Session rules:** production and DJ are private, 2–4h; wellness is group-only, min 10.
- **Decision:** Open Door layout plus the brief's palette and fonts, all as tokens in `globals.css`.
- **Media:** processed into `web/public/media/**`, with the manifest in `web/src/content/media.ts`.
  Done by the media agent.
- **Research findings:**
  - Airbnb Experiences has native 2-way Google Calendar sync (help article 2822).
  - Viator has no iCal sync, so use admin "Block time" or Bókun.
  - Cal.com v2 headers: slots `2024-09-04`, bookings `2026-02-25`.

## What I (orchestrator) built — foundation, all typechecked and unit-tested
- **Next 16 app** in `web/` with Cache Components off (`next.config.ts`).
- **Data:** Drizzle + Postgres. Local dev uses PGlite (`.data/pglite`, single process).
  Production uses `DATABASE_URL`.
  - `src/lib/db/schema.ts` and migration `drizzle/0000_init.sql`.
- **Domain logic:**
  - `src/lib/booking/pricing.ts`, `availability.ts`, `service.ts`. The service handles
    the hold → pay → confirm lifecycle, cancel/refund, reschedule, manual bookings,
    advisory locks and the waitlist.
- **Integrations:**
  - `src/lib/integrations/calcom.ts`, `stripe.ts`: no-ops when unconfigured.
  - `src/lib/email/send.ts` and the `notify.ts` interface (automation agent fills in the templates).
  - `src/lib/ics.ts`.
- **Supporting libs:** `src/lib/queries/public.ts`, `src/lib/auth.ts` + `src/proxy.ts`
  (admin password cookie), `src/lib/{config,time,money,ids}.ts`.
- **Design:** `src/app/globals.css` (design system) and `src/app/layout.tsx` (fonts).
- **Scripts:**
  - `scripts/seed.ts`: experiences, disabled add-ons, and 11 real reviews (BRIEF + promo reel).
    `--demo` adds bookings, events, inquiries, `WELCOME10`, `RAW-DEMO-GIFT-CARD`.
  - `scripts/migrate.ts`.
- **Tests:** `tests/unit/{pricing,availability}.test.ts`, 18 passing, including DST.
- **Docs:** `docs/ARCHITECTURE.md`, `docs/SETUP.md` (go-live checklist for the client), `.env.example`.

## Build agents (parallel, each owns separate paths) — see their handoff notes
| Area | Owns | Key contract |
|---|---|---|
| site | `src/app/(site)/**` except booking pages, `src/components/site/**`, `src/content/site.ts`, `/api/inquiries`, `/api/events/[slug]/rsvp`, `/api/reviews`, sitemap/robots/OG/not-found | embeds `BookingWidget` |
| booking | `src/components/booking/**`, `/book`, `/book/[slug]`, `/checkout/test/...`, `/booking/[code]`, `/manage(/[code])`, `/gift-cards`, `/api/{availability,quote,checkout,waitlist,bookings/*}`, `/api/webhooks/{stripe,calcom}`, `src/lib/giftcards.ts`, `src/lib/booking/calcom-sync.ts`, `tests/e2e/`, `playwright.config.ts` | `BookingWidget({experiences, initialSlug?, compact?})`; giftcards exports `createGiftCardPurchase`, `fulfillGiftCard`, `issueGiftCard`, `voidGiftCard`, `adjustGiftCardBalance`, `getGiftCardBalance` |
| admin | `src/app/admin/**`, `src/components/admin/**`, `src/app/api/admin/**`, `src/lib/admin/**` | uses the service + giftcards + feeds |
| automation | `src/lib/email/notify.ts` (impl), `src/emails/**`, `src/lib/feeds.ts`, `src/lib/calendar-feed.ts`, `src/lib/automation/**`, `/api/cron/**`, `/api/calendar/[file]`, `/api/dev/emails/[template]`, `vercel.json`, `docs/AUTOMATIONS.md` | `syncCalendarFeeds(feedId?)`, `getCalendarFeedUrl()`, `regenerateCalendarFeedToken()` |

Shared files are orchestrator-only: schema, `booking/{service,availability,pricing}`,
integrations, `send.ts`, queries, `globals.css`, root layout. Agents report needed
changes rather than editing them.

## Environment rules
- The dev server runs on **http://localhost:3300**: `cd web && npx next dev -p 3300`.
  Ports 3000 and 3100 are used by other projects.
- PGlite is single-process. Don't run `db:*` or `tsx` scripts while the dev server runs.
  To reset: stop the dev server, run `npm run db:reset`, then restart it.
- Admin password in dev: `rawplanet`.
- No commits yet. The repo root is `/Users/jaredbeguelin/code/RawPlanet` on branch main.
  Commit only when asked or when finished, using the attribution lines.

## Paused state (13:3x, Nov 4)
All four agents stopped cleanly. The dev server has been stopped too, so restart it on resume.

**Progress at pause:**
- **booking:** APIs, webhooks, `giftcards.ts` and `calcom-sync.ts` written. `BookingWidget` and every booking page not started. BookingWidget is the most urgent piece, because the site agent is waiting on it.
- **site:** layout, components, copy and home written. All other pages not started.
- **admin:** shell, login, queries and booking actions written. No screens yet.
- **automation:** email foundation and booking templates written. `notify.ts` bodies, jobs, feeds, cron and calendar routes not started.

**Shared-code bugs to fix (orchestrator):**
- `service.ts` ~L351/361: `fulfillBooking` re-confirms a cancelled booking when a late payment arrives. It should refund rather than confirm when status is cancelled.
- `ics.ts:16`: the escape doesn't escape `;` properly.
- `ics.ts:110`: all-day events land at 1am NY during daylight saving time. Use `fromLocal` instead.

**To resume:** start the dev server, then re-spawn the 4 agents, pointing each at its handoff note and its original brief. The ownership and contracts are in the table above.

## Remaining plan (orchestrator)
1. Collect the agents' reports. Fix the shared-code bugs they report, and apply any
   schema changes (`npm run db:generate`).
2. Integration pass:
   - `npx tsc --noEmit`, `npx eslint`, `npx vitest run`.
   - Stop the dev server, run `npm run db:reset`, then `next build`.
   - Restart the dev server and run the e2e suite (`E2E_BASE_URL=http://localhost:3300 npx playwright test`).
3. Visual QA of every page at 1440 and 390, plus a design polish pass. Use the `agent-desktop` skill to drive the real browser (and check mobile views), not only headless Playwright.
4. Run a security review of the checkout, webhooks, manage-token, admin auth and cron auth.
5. Write a competitive feature matrix against Airbnb, FareHarbor and Peek. Fill gaps
   (e.g. ES language toggle, deposits, SMS, analytics) where cheap.
6. Final report to the user, then a commit (ask first).

## Resumed (Nov 4, ~13:35, new session)
- Fixed shared bugs: `fulfillBooking` now routes non-pending/expired bookings to `refundLatePayment` (records + refunds once per payment intent, never re-confirms); `ics.ts` `;` escape; all-day ICS dates via `zonedToUtc` NY midnight.
- Shared asks done: `createManualBooking({occasion})`, `addInternalNote` now appends to `bookings.internalNotes` too, `siteUrl()`/.env.example default port 3300.
- tsc clean (except stale .next types), vitest 18/18. Dev server restarted on :3300. Four agents re-spawned from their handoff notes.
- New scratchpad for this session: `/private/tmp/claude-501/-Users-jaredbeguelin-code-RawPlanet/0d96727f-9b2c-47c5-957f-2acf79b60065/scratchpad/`
- User asked agents to switch visual checks from Playwright to `agent-desktop`. Shared multi-agent session `run-1793813905198-52218-0` (cursor overlay on), agent ids booking/site/admin/automation, each in its own Chrome with a throwaway `--user-data-dir` under the session scratchpad. Brief: `…/scratchpad/desktop-qa-brief.md`. Playwright stays only for the e2e regression suite.
- New skills (installed mid-session, loaded by reading SKILL.md directly): ponytail (full) + ponytail-review for all agents, context-optimization for all, Anthropic frontend-design for site/booking/admin. Brief: `…/scratchpad/new-skills-brief.md`. claude-mem is hook-based, so it starts recording only in the next fresh session.
- User allowed Playwright as a fallback for visual QA (agent-desktop stays primary). Agents report which tool verified what.
- AUTOMATION AGENT DONE (see docs/handoff/automation.md). Orchestrator TODOs from it: (1) schema: add `language` to gift_cards, inquiries, waitlist, event_rsvps (+ db:generate at the integration pass); (2) gap: gift recipient isn't emailed when the purchaser cancels/moves a gifted session; (3) told booking agent to make ics SEQUENCE count all reschedules. vitest is now 51 tests (feeds test ~40s).
- User's Mac low on memory: all agents told to follow `…/scratchpad/cleanup-brief.md` (one browser at a time, quit Chrome when idle, delete unneeded shots). Automation scratchpad trimmed to its shots/.
- SITE AGENT DONE (see docs/handoff/site.md). Deleted default `src/app/favicon.ico`. Deferred to the integration pass (schema changes would break the running dev DB for the agents still working): unique index on `reviews.booking_id`; `language` columns from automation. Needs from client/user: `MEETUP_GROUP_URL` (not in the client email), meditation video testimonials, OK on terms/privacy wording. Dev DB has QA rows from site-qa@ / flow-qa*@example.com (db:reset clears them).
- ADMIN AGENT DONE (see docs/handoff/admin.md). Added `resendConfirmation(bookingId)` to service.ts (stamps confirmationSentAt only if the email was actually sent); admin action now uses it. Deferred: optional `reviews.video_url` column; unit tests for admin parsers (block ranges, hours/durations, monthly repeats).
- BOOKING AGENT DONE (see docs/handoff/booking.md). All 4 agents finished.
## Integration pass (15:2x)
- Shared fixes: Stripe/test cancel URL now carries `&t=<manageToken>`; `/book/[slug]` releases a hold only via `getBookingForCustomer` (+ `referrer: same-origin`). Migration `drizzle/0001_language_reviews.sql`: `language` on gift_cards/inquiries/waitlist/event_rsvps, `reviews.video_url`, unique `reviews_booking_idx`. `src/lib/lang.ts` `requestLang(req)` (Accept-Language) stored on inquiry/waitlist/RSVP/gift-card; notify `customerLang(email, stored)` prefers stored "es". Deleted default favicon.ico. `resendConfirmation()` in service.
- Results: db:reset OK, tsc clean, eslint clean, vitest 51/51, `next build` OK, e2e 10/10 (first cold run had 2 compile-timeout failures; two warm reruns 10/10).
- Remaining: security review (in progress via a fresh reviewer agent), my visual pass incl. 2 unchecked event-page CSS fixes, admin UI for reviews.video_url + public video testimonials section, gift-recipient email on cancel/move, admin parser unit tests, competitive matrix, final report, commit (ask first).
- Added: guest video testimonials (`src/lib/video.ts` + tests: YouTube/Vimeo privacy embeds or .mp4/.webm/.mov, https or /media only; admin Reviews "Add video" + field on "Add a review"; `GuestVideo` cards on /reviews before the reels). Verified end to end in a browser (bad link rejected, saved, shown at 1440/390, removed).
- Added: gift recipients now get the cancelled/rescheduled emails too (no refund panel, no manage link).
## Security review (fresh reviewer agent) → all 13 findings addressed
- H1 gift card over-redemption: live holds reserve card balance at quote/create (`liveHolds`); confirmation debits atomically (`balance >= x`), and a shortfall cancels + refunds (email has `giftShort` wording). Re-ran the exploit: second booking now refused.
- H2 double cancel: cancel claims the row first (`UPDATE … WHERE status='confirmed'`), Stripe refund after the claim (restores status if the refund throws), atomic gift credit.
- M3 promo limit: live holds count toward `maxRedemptions`.
- M4 calendar squatting: max 2 live unpaid checkouts per email. (Turnstile not added: needs keys.)
- M5 test checkout: `integrations.testCheckout()` = no Stripe AND (not production OR `ALLOW_TEST_CHECKOUT=1`); page/action/createBooking/gift cards all gated.
- M6 inquiry relay: auto-reply no longer echoes name/message; `firstName()` letters-only ≤24 chars everywhere.
- L7 void card never revived on cancel (logged for host instead). L8 review links use their own HMAC token (`src/lib/review-token.ts`), not the manage token. L9 unpaid checkouts don't rewrite existing customer profiles; profile refreshed on payment. L10 `fulfillBooking` returns early when another request already confirmed (no duplicate Cal.com events). L11 admin JWT key = AUTH_SECRET + ADMIN_PASSWORD (change password = sign out everywhere; SETUP.md notes it). L12 `/manage` sends links via `after()`. L13 feeds: private-IP block after DNS, manual redirects re-checked, streamed 5 MB cap (+ unit test).
- Verified: tsc/eslint clean, vitest 60/60, e2e 10/10.
- CAPTCHA (user request): Cloudflare Turnstile on checkout, waitlist, gift cards, RSVP, inquiries/contact, and "find my booking". `src/lib/turnstile.ts` (server verify; no-op without TURNSTILE_SECRET_KEY; fails open only if Cloudflare is unreachable), `src/components/Turnstile.tsx` (explicit render, invisible "interaction-only", waits ≤8s for the token at submit, reset after a failed submit). Admin Settings shows status; SETUP.md §5 + .env.example. Verified with Cloudflare test keys: no token → refused; always-fail secret → forged token refused; e2e 10/10 with the live widget; then keys removed from .env.local (dev runs without Turnstile).
## Prototype deploy (Nov 4)
- Branch `direct-booking-platform` (commits 7edbdce, ad51fef, + this note). Not pushed.
- Vercel project `raw-planet-experiences` (team jareds-projects, Hobby) → https://raw-planet-experiences.vercel.app
- DB: Neon free resource `raw-planet-db` via Vercel Marketplace (DATABASE_URL injected). Migrated + seeded with `--demo` from local (`DATABASE_URL=<unpooled> npx tsx scripts/{migrate,seed}.ts --demo`).
- Env (production): ADMIN_PASSWORD (given to user), AUTH_SECRET, CRON_SECRET, ALLOW_TEST_CHECKOUT=1, SITE_NOINDEX=1, NEXT_PUBLIC_SITE_URL. No Stripe/Resend/Cal.com/Turnstile keys → test checkout, emails only logged in Admin → Emails.
- Hobby allows daily crons only: deployed with a temporary `vercel.json` cron `0 13 * * *`; repo keeps `*/10`. Redeploy the same way (swap, `npx vercel deploy --prod`, `git checkout -- vercel.json`), or upgrade to Pro / add an external pinger (docs/AUTOMATIONS.md).
- Live checks: all main pages 200 (<2s), robots Disallow + noindex meta, availability from Neon, test booking → pay → confirmation OK (e2e), admin login OK; the e2e booking RP-UVUK4J was cancelled + refunded via admin. Unsigned webhooks correctly refused in production.
