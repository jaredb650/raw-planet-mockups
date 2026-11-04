# Handoff: automation engineer (emails, cron jobs, calendar feeds)

Last updated: Nov 4, end of the resumed session. Feature-complete for the brief. Not committed.
Brief = "customer email automation, scheduled jobs and calendar feeds". Full user-facing docs: `docs/AUTOMATIONS.md`.

Skills applied (coordinator brief): ponytail (full), ponytail-review on my own diff, context-optimization.

## 1. Status: DONE
- Templates (EN + ES, all rendered and screenshotted): `src/emails/templates/{booking,giftcards,inquiry,misc,host}.tsx`, 25 preview keys.
  Foundation: `theme.ts`, `i18n.ts` (incl. `withDot()` so Spanish "p. m." never gets a double period), `copy.ts`, `components/{ui,Layout}.tsx`, `types.ts`.
- `src/emails/view.ts`: pure DB-rows → BookingView (address placeholder detection, price lines, gift-recipient audience = no manage link).
- `src/emails/render.ts`, `src/emails/samples.ts` (fixtures + registry).
- Preview route `/api/dev/emails/<key>?lang=es&theme=dj&format=text|json&frame=390`, index at `/api/dev/emails/index`. Dev, or admin in prod.
- `src/lib/email/notify.ts`: every original export + signature kept, `manageUrl` kept; new: `try*` variants (return `SendStatus`) used by jobs,
  `sendReviewNudge(bookingId)`, `sendHostDigest(now?)`. Dedupe (2 min), `.invalid` skip, `.ics` attachments (UID `${booking.id}@rawplanetexperiences.com`,
  SEQUENCE = max(#rescheduled events, rescheduleCount) + 10 when cancelled), reply-to guest on host alerts.
- `src/lib/automation/{settings,rules,jobs}.ts`, `/api/cron/run`, `vercel.json` (*/10).
- `src/lib/feeds.ts`, `src/lib/calendar-feed.ts`, `/api/calendar/[file]`.
- Tests: `tests/unit/ics.test.ts` (escaping incl. `;`, folding, NY-midnight all-day in EDT/EST/across DST, TZID), `automation-rules.test.ts`,
  `feeds.test.ts` (real PGlite in a temp dir, fetch stubbed; ~40s because of PGlite start-up).

## 2. Verification done
- `npx tsc --noEmit` clean (except stale `.next/types/validator.ts`), eslint clean on my paths, vitest all green.
- HTTP: `/api/cron/run` sent 1 reminder + 1 follow-up + digest on demo data; second run sends nothing; `?job=nope` → 400.
- Export feed via admin page (dev cookie) → 200 text/calendar, 12 events, folded lines; bad token → 404.
- Visual: agent-desktop was blocked (`global_window_inventory_unstable`, 30+ retries), so per the user's fallback rule every template was captured with
  headless Playwright at exact 600 and 390, EN + ES (`scratchpad/automation-agent/pw-sweep.mjs` → `shots/{600,390}/<key>-<lang>.png`).
  One agent-desktop-adjacent capture of my own Chrome window: `shots/index-cg.png`.

## 3. Not done / follow-ups
- Gift-booking RECIPIENT isn't emailed when the purchaser cancels or reschedules (the purchaser is). Needs recipient variants of those two templates.
- Booking agent's `/api/bookings/[code]/ics` uses SEQUENCE = rescheduleCount (+10 cancelled); rescheduleCount only counts customer moves, so after an
  admin move a re-downloaded invite can be ignored by calendars. Suggest the same rule as notify.ts (count of `rescheduled` events).
- Feeds: RRULE recurring events are not expanded (documented).

## 4. Shared-code / schema asks (orchestrator)
- Schema: `language` column on `gift_cards`, `inquiries`, `waitlist`, `event_rsvps` (today these use `customers.language` by email, else English,
  so a first-time Spanish speaker gets English). The forms already know the page language.
- Seed addresses are placeholders; emails detect them and say "Alex will email the exact address". Alex must enter real addresses in admin
  before launch, or reminders won't carry an address.

## 5. Contracts (final)
- notify.ts: all original exports/signatures unchanged + `manageUrl`. New: `sendReviewNudge`, `sendHostDigest`, `try*`, `SendStatus`.
- `src/lib/feeds.ts`: `syncCalendarFeeds(feedId?): Promise<FeedSyncResult[]>` (never throws; full sync also frees paused feeds' blocks),
  `previewCalendarFeed(url)`, `clearFeedBlocks(feedId)`, `normalizeFeedUrl(url)`. Used by admin availability actions.
- `src/lib/calendar-feed.ts`: `getCalendarFeedUrl(): Promise<string>`, `regenerateCalendarFeedToken(): Promise<string>` (returns the NEW URL),
  `verifyCalendarFeedToken`, `buildCalendarFeed`. Used by admin availability page/actions.
- `src/lib/automation/settings.ts`: `getSetting`, `setSetting`, `getStringSetting` (admin settings page uses these). Keys: `calendarFeedToken`,
  `cronLock`, `lastCronRun` {at, ok}, `lastDigestDate`, `hostPhone`, `hostWhatsapp`.
- `/api/cron/run`: Bearer `CRON_SECRET` | admin session | dev without secret. GET/POST, `?job=a,b`.
