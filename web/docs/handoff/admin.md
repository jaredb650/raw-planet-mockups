# Admin dashboard handoff (owner of src/app/admin/**, src/components/admin/**, src/app/api/admin/**, src/lib/admin/**)

Last updated: Nov 4, session 2 (resumed). Visual checks: **agent-desktop** primary (own Chrome, profile `admin-agent/chrome-profile`, window w-31269); headless Playwright allowed as fallback when agent-desktop is blocked or for an exact 390px viewport (user decision).
Skills applied: ponytail (full; lean implementations, no features dropped), ponytail-review (on own diff before the final report), context-optimization (scoped snapshots, grep over full logs), frontend-design (polish pass; brand tokens in globals.css win).
After each login in the agent-desktop Chrome: `list-windows --app "Google Chrome"` and close any Chrome prompt (save password etc.). An open "Save password?" prompt froze the shared inventory for every agent once.

## 1. Status
Type-checked (`npx tsc --noEmit` clean apart from stale `.next/types/validator.ts`) and `npx eslint` clean on admin paths.

Done:
- Foundation (session 1): admin.module.css, shell.module.css, Shell, Mark, Icon, ActionForm (+SubmitButton, ConfirmSubmit, FormMessage), CopyButton, Pill, PageHeader/Panel/Empty, format.ts, types.ts; lib/admin/{action,csv,badges,dashboard}.ts; login + (panel) layout.
- **Today** `(panel)/page.tsx`: Today/Tomorrow run sheets, Needs attention (calendar errors with "Mark fixed", feed errors, deliverables, inquiries, reviews, failed emails, live checkout holds), KPI strip, 30-day revenue bars, source mix.
- **Bookings**: `lib/admin/bookings.ts` (parseBookingFilters/filterQuery/listBookings/getBookingDetail/experienceOptions); list `(panel)/bookings/page.tsx` (tabs Upcoming/Past/Cancelled/Unpaid & expired/All with counts, search, source/experience/date filters, pager); CSV `/api/admin/export/bookings.csv` (same filters); detail `bookings/[id]/page.tsx` (session/guest/payment/timeline+note/emails; actions: completed/no-show/undo, reschedule with slot picker or forced time, track delivery, refund, resend confirmation, cancel with policy/full/part/none, copy manage link); new `bookings/new/page.tsx` + `components/admin/NewBookingForm.tsx` (source-aware hints, prefill from ?inquiry= / ?date=&time= / ?exp= / ?source=). `/api/admin/availability` (one day's slots; host may book "notice" slots; 401 signed out).
- `createManualAction` now passes `occasion` to `createManualBooking` (no direct write).
- **Calendar** `(panel)/calendar/page.tsx` + `lib/admin/calendar.ts` + `cal.module.css`: Day/Week/Month/List views; week = time grid on desktop, day list on phone; month = compact counts on phone; empty hour → new booking prefilled; block click → side panel with Remove; "Block time off" form (BlockForm).
- **Availability actions** `(panel)/availability/actions.ts`: createBlockAction (all-day, multi-day, weekly repeat, per-experience), deleteBlockAction (manual only), add/toggle/delete/sync feed actions wired to `src/lib/feeds.ts`.

- **Availability** page: block form, upcoming blocks (deduped across resource groups) with Remove, imported calendar feeds (add with preview check, pause/resume, sync one/all, remove, last sync and error), "how double-booking is prevented" explainer, private export feed (copy, Google, webcal, regenerate), opening-hours summary.
- **Customers** list (search, opt-in filter, sorts, lifetime stats) + CSV `/api/admin/export/customers.csv`; detail (bookings, gift cards, inquiries, RSVPs, editable name/phone/language/notes/opt-in).
- **Experiences** cards + editor (basics, live toggle, pricing mode + durations table, guests/age, weekly hours with 2 windows/day, step/buffer/notice/advance/cancellation, address with placeholder warning, highlights/includes/good-to-know, Cal.com event type, Airbnb link) + add-ons CRUD; "Add an experience" creates a hidden draft.
- **Gift cards** list (unspent liability KPI, search) + give-a-card form; detail (history, re-send, adjust balance, void). **Promos** list + create/edit/toggle/delete-if-unused (kind inferred from percent vs amount field).
- **Reviews** tabs (waiting/on website/hidden/all), publish/hide/feature/reply/delete, add a review copied from Airbnb/Google/Viator.
- **Events** list (upcoming/past, going counts), new (repeat weekly/biweekly/monthly × N), detail (edit, apply to later dates in series, RSVP list + add/remove + CSV `/api/admin/export/rsvps.csv`, series dates + "add more dates", delete when no RSVPs).
- **Inquiries** tabs, reply by email/text, make a booking (prefilled), mark replied/close/reopen; `?open=` highlights one.
- **Emails** log with status tabs, search, sandboxed preview via `/api/admin/emails/[id]` (CSP sandbox), test-mode notice.
- **Settings**: host phone/WhatsApp (settings keys `hostPhone`, `hostWhatsapp`), automations last run + Run now (`runJobs`), connection status, account/sign out.

## 2. In progress
Nothing. All screens in the brief are built, type-checked, linted and visually checked.

## 3. Next steps (if resumed)
- Orchestrator asks in section 7. Unit tests for the admin parsers (block spans, hours/durations parsing, monthly event repeats) need a home under tests/unit (not an admin-owned path).
- Video testimonials: no schema field yet, so Reviews has no video upload/URL.

## 4. Files created this session
src/app/admin/(panel)/{page.tsx, bookings/page.tsx, bookings/[id]/page.tsx, bookings/new/page.tsx, calendar/page.tsx, availability/actions.ts}; src/app/api/admin/{availability/route.ts, export/bookings.csv/route.ts}; src/lib/admin/{bookings.ts, calendar.ts}; src/components/admin/{SlotPicker.tsx, picker.module.css, BookingForms.tsx, NewBookingForm.tsx, BlockForm.tsx, detail.module.css, cal.module.css}. Shell top bar now shows "Raw Planet" (page H1 carries the section name).

## 5. Contracts
- `src/lib/giftcards.ts`: EXISTS, matches.
- `src/lib/feeds.ts`: EXISTS — `syncCalendarFeeds(feedId?) → FeedSyncResult[]`, also `previewCalendarFeed`, `normalizeFeedUrl`, `clearFeedBlocks` (used by admin).
- `src/lib/calendar-feed.ts`: EXISTS — `getCalendarFeedUrl()`, `regenerateCalendarFeedToken()`, `toWebcalUrl()`.
- `/api/cron/run`: EXISTS (route + `src/lib/automation/jobs.ts` `runJobs()`; Settings "Run now" calls `runJobs` directly).

## 6. Tests / screenshots
Scratchpad: /private/tmp/claude-501/-Users-jaredbeguelin-code-RawPlanet/0d96727f-9b2c-47c5-957f-2acf79b60065/scratchpad/admin-agent/
- `pw/<screen>-1440.png` and `pw/<screen>-390.png` (headless Playwright, exact 1440 and 390 viewports, signed-in cookie): every screen. Reviewed by eye; fixes applied (field alignment, select height, legend swatches, confirmation checkbox, actions-first on phone, collapsed hours, timeline case).
- agent-desktop (own Chrome, profile seeded with the password manager off): login, Today accessibility tree, New booking flow (slot picker → 6pm → guest → Add booking → RP-6TPM3B created, confirmation email logged), Cancel flow on that booking (policy $0 inside 24h, full refund $120 → Cancelled, refunded). Its screenshots timed out on shared-window churn, so screenshots are Playwright.
- curl (`smoke.sh` + `cookie.mjs`): every page 200 signed in; every page 307 → /admin/login?next=… signed out; every /api/admin route 401 signed out or with a forged cookie; CSV exports produce rows.
- `npx tsc --noEmit` clean (stale .next validator only), `npx eslint` admin paths clean.

## 7. Known issues / shared-code notes
- `resendConfirmationAction` still writes `bookings.confirmationSentAt` directly (no service fn for resend). Ask: `resendConfirmation(bookingId)` in service.ts.
- `refundBooking` / `cancelBooking` with no Stripe key record refunds without sending them anywhere; the detail page marks those "(not sent to Stripe)".
- Login throttle is per-instance memory (marked `shortcut:` in login/actions.ts).
