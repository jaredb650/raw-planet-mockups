# Handoff: booking engineer (guest flow, payments, webhooks, self-service, gift cards)

Last updated: 2026-11-04 (session 2). **BookingWidget is WRITTEN, tsc + eslint clean** — site agent can swap BookingSlot for it. API layer done. `tsc` is clean for my files (the only errors are stale `.next/types/validator.ts`, not mine). Smoke-tested over HTTP: availability, quote (WELCOME10 works), Cal.com PING webhook.

## 1. Status: API layer + widget + all booking pages done (see 2, 3a, 6)
- `src/app/api/_lib/http.ts`: clientIp, in-memory token-bucket `rateLimit` + `LIMITS`, `jsonError`, `fieldErrors`, `domainErrorResponse` (BookingError slot_unavailable→409, not_found→404, payment/calendar→502, else 400; PricingError→400), `readJson`, `dateKeySchema`.
- `src/lib/giftcards.ts`: full service (see section 5). It also exports `GiftCardError`, `GIFT_CARD_MIN/MAX_CENTS`, `giftCardLinkToken`/`verifyGiftCardLinkToken` (HMAC with AUTH_SECRET or the dev fallback), `giftCardSuccessPath(id)` → `/gift-cards/success?id=&k=`, `getGiftCard`, `expireGiftCardPurchase` (sets status to void; the schema has no "expired" status). Test-mode purchase URL: `/checkout/test/gift_card/<id>?t=<giftCardLinkToken>`.
- `GET /api/availability` (62-day cap, no-store; `booking`+`t` params → ignoreBookingId for reschedule).
- `POST /api/quote`, `POST /api/checkout` (zod, honeypot `website`, rate limit; body is flat: experience, start, duration, guests, addonIds, promoCode, giftCardCode, name, email, phone, language, occasion[birthday|date|team|just_because|other], notes, marketingOptIn, acceptPolicies:true, isGift, giftRecipientName/Email, giftMessage) → `{url, code}`.
- `POST /api/waitlist` (dedupes on experience+date+email).
- `GET /api/bookings/[code]/status?t=&session_id=` (calls reconcileBookingPayment).
- `GET /api/bookings/[code]/ics?t=`: imports `@/components/booking/server/calendar-event` (`bookingCalendarEvent(booking)` → {summary, description, location, url}). Now exists (see below).
- `src/app/api/_lib/stripe-sync.ts`: `processStripeEvent` (completed+paid / async_succeeded → fulfillBooking or fulfillGiftCard; async_failed / expired → expireBooking or expireGiftCardPurchase; charge.refunded → sync external refunds, skipping known stripeRefundId and refunds with metadata.bookingId). Also `reconcileBookingPayment` and `reconcileGiftCardPayment` (retrieve the Checkout Session directly). It only fulfils bookings in pending_payment/expired, which guards the service bug below.
- `src/app/api/webhooks/_lib/idempotency.ts` (webhook_events check before processing, mark after; `allowUnsignedInDev` accepts unsigned events when the secret is unset and NODE_ENV != production, for local e2e).
- `POST /api/webhooks/stripe` (static `Stripe.webhooks.constructEvent`), `POST /api/webhooks/calcom` (idempotency key = sha256 of the body).
- `src/lib/booking/calcom-sync.ts`: applyCalCancellation (status cancelled, by system, no refund, internal note "Cancelled in Cal.com — review refund in admin", host alert, waitlist), applyCalReschedule, importCalBooking (source "cal", matched by calEventTypeId), processCalEvent. None of these call back into Cal.com. Echoes are ignored.

## 2. Session 2 progress
- Widget files written: format.ts, MonthCalendar.tsx, SlotPicker.tsx, GuestStepper.tsx, WaitlistForm.tsx, BookingPicker.tsx, BookingWidget.tsx, booking.module.css. Date/slot selection is derived during render (no effects); month auto-advance (max 3 hops) uses render-time state adjustment to satisfy react-hooks/set-state-in-effect.
- Pages WRITTEN, tsc/eslint clean, HTTP smoke-tested (200s; bad tokens 404 / 'link not valid'): `(site)/book`, `(site)/book/[slug]` (+ CheckoutForm; re-checks the slot server-side, `?cancelled=CODE` expires pending hold), `(site)/checkout/test/[kind]/[id]` (+ actions.ts, TestPayForm; 404 when Stripe configured), `(site)/booking/[code]` (+ StatusPoller, server/BookingDetails), `(site)/manage` (+ actions.ts requestManageLinks, ManageFinder), `(site)/manage/[code]` (+ actions.ts reschedule/cancel, RescheduleForm, CancelDialog, public timeline), `(site)/gift-cards` (+ GiftCardForm, GiftCardBalance), `(site)/gift-cards/success` (+ GiftCardPending), `api/gift-cards` POST, `api/gift-cards/balance` GET. Page styles: `components/booking/pages.module.css`.
- NOT yet done: visual QA, e2e spec + playwright.config.ts, webhook HTTP exercise.
- Visual QA method switched (coordinator): use agent-desktop CLI, not Playwright, to look at pages. See scratchpad/desktop-qa-brief.md. Playwright is still used for the e2e spec deliverable only.

- Visual QA: agent-desktop was blocked on every attempt (list-windows/resize/screenshot → TIMEOUT global_window_owner_churn from the shared session). Per the user's fallback decision, visual QA uses headless Playwright screenshots (scratchpad/booking-agent/shots.mjs → shots/). My Chrome instance was closed.
- Skills applied (coordinator, mid-session): ponytail (full) for lean changes, ponytail-review on my diff before the final report, context-optimization (scoped snapshots, no big dumps), frontend-design for polish (Open Door mockup + globals.css tokens win on conflict).
- Written: `playwright.config.ts` (no webServer, baseURL E2E_BASE_URL or :3300, workers 1, output .data/e2e-results, projects desktop + mobile(@mobile grep)), `tests/e2e/booking.spec.ts`.

## 2a. Session 1 notes
- DONE: `src/components/booking/server/calendar-event.ts` (`bookingCalendarEvent(booking, experience?)` → {summary, description, location, url, googleUrl}).
- DONE (complete, not yet type-checked or used): `src/components/booking/dates.ts` (pure Monday-first month grid, addDays/addMonths, first/lastOfMonth, longDate/shortDate/monthLabel in NY time, re-exports todayKey) and `src/components/booking/useAvailability.ts` ("use client"; `useAvailability({slug, duration, month:"YYYY-MM", booking?:{code,token}})` → {status idle|loading|ready|error, days: Record<date, ApiDay>, calendarError, error, reload}, a 30s module cache, and `dayState(day)` → available|full|unavailable, where "full" means some slot is booked/blocked/calendar → waitlist).
- PAUSED by the coordinator here. Next file to write: `src/components/booking/MonthCalendar.tsx`.

## 3. Next steps (remaining)
1. e2e: **10/10 passed** (desktop 9 + mobile 1) on the final run, `E2E_BASE_URL=http://localhost:3300 npx playwright test`. Under heavy load, earlier runs timed out (2 to 13s page loads); the timeouts are now generous.
2. Optional polish: fewer eyebrows (frontend-design "template chrome" note); the widget's calendar column has empty space below the legend at 1440.
3. Ask orchestrator for the shared changes in section 7.

## 3a. Session 2 fixes found by visual QA (done)
- /book/[slug] defaulted guests to the minimum (1) → now defaultGuests (2) unless ?guests= is given.
- Duplicate "Your details" headings → form section renamed "Contact details"; required asterisks removed (optional fields are labelled).
- Promo/gift code showed "Applied." before the server confirmed → "Checking…" until the fresh quote lands.
- Checkout summary now first on phones (<960px).
- Calendar padding cells made the first week row taller → fixed.
- Test checkout used useActionState → plain server-action forms + SubmitButton (works pre-hydration).
- **referrer: "no-referrer" broke server actions** (Chromium sends Origin: null → Next CSRF check → "Invalid Server Actions request", 500). Token pages now use referrer "same-origin" (still never leaks the token cross-site).
- Promo/gift-card <details> was controlled by "code applied", so "Remove" collapsed it → now uncontrolled. (The e2e also clicked "Remove a guest" via a substring match → matchers now exact.)
- /api/bookings/[code]/ics SEQUENCE now matches notify.ts (count of all `rescheduled` events, max with rescheduleCount, +10 if cancelled). UID is `${booking.id}@rawplanetexperiences.com` in both.

## 4. Files created (all new; no shared files edited)
- src/app/api/_lib/http.ts
- src/app/api/_lib/stripe-sync.ts
- src/app/api/availability/route.ts
- src/app/api/quote/route.ts
- src/app/api/checkout/route.ts
- src/app/api/waitlist/route.ts
- src/app/api/bookings/[code]/status/route.ts
- src/app/api/bookings/[code]/ics/route.ts
- src/app/api/webhooks/_lib/idempotency.ts
- src/app/api/webhooks/stripe/route.ts
- src/app/api/webhooks/calcom/route.ts
- src/lib/giftcards.ts
- src/lib/booking/calcom-sync.ts
- src/components/booking/server/calendar-event.ts
- src/components/booking/dates.ts
- src/components/booking/useAvailability.ts
- Session 2: src/components/booking/{format.ts, MonthCalendar.tsx, SlotPicker.tsx, GuestStepper.tsx, WaitlistForm.tsx, BookingPicker.tsx, BookingWidget.tsx, booking.module.css, pages.module.css, CheckoutForm.tsx, StatusPoller.tsx, ManageFinder.tsx, RescheduleForm.tsx, CancelDialog.tsx, GiftCardForm.tsx, GiftCardPending.tsx, SubmitButton.tsx, server/BookingDetails.tsx}
- src/app/(site)/{book/page.tsx, book/[slug]/page.tsx, checkout/test/[kind]/[id]/{page,actions}.ts(x), booking/[code]/page.tsx, manage/{page,actions}.ts(x), manage/[code]/{page,actions}.ts(x), gift-cards/page.tsx, gift-cards/success/page.tsx}
- src/app/api/gift-cards/route.ts, src/app/api/gift-cards/balance/route.ts; edited src/app/api/bookings/[code]/ics/route.ts (SEQUENCE)
- playwright.config.ts, tests/e2e/booking.spec.ts
- docs/handoff/booking.md (this note)

## 5. Contracts
- BookingWidget: `export function BookingWidget(props: { experiences: PublicExperience[]; initialSlug?: string; compact?: boolean })` in src/components/booking/BookingWidget.tsx ("use client", also default export). **WRITTEN, tsc/eslint clean.** It brings its own bordered card; the page supplies the heading. Container-query responsive (stacked < 800px container width). compact + initialSlug shows only that experience.
- src/lib/giftcards.ts (written, matches the brief):
  - `createGiftCardPurchase(input: { amountCents; purchaserName; purchaserEmail; recipientName?; recipientEmail?; message?; deliverOn?: "YYYY-MM-DD" }): Promise<{url}>`
  - `fulfillGiftCard(id, {amountPaidCents, paymentIntentId?, checkoutSessionId?}): Promise<GiftCard>` (idempotent)
  - `issueGiftCard({...}): Promise<GiftCard>`
  - `voidGiftCard(id, reason): Promise<void>`
  - `adjustGiftCardBalance(id, deltaCents, note): Promise<GiftCard>`
  - `getGiftCardBalance(code): Promise<{balanceCents, status} | null>`

## 6. E2E / verification status
- tests/e2e/booking.spec.ts: book→test pay→confirm→.ics→manage→reschedule→cancel; leave checkout releases hold; promo code; buy $300 gift card → $0 booking → cancel returns balance; manage links neutral + bad tokens; calendar keyboard; API validation; unsigned webhooks; @mobile no-overflow + CTA in viewport. Buys its own gift card (doesn't consume RAW-DEMO-GIFT-CARD).
- Webhooks exercised over HTTP with unsigned dev payloads (scratchpad/booking-agent/webhooks.sh): Stripe completed→confirmed, replay→duplicate, charge.refunded partial→partially_refunded + public timeline entry, Cal RESCHEDULED→moved, Cal CANCELLED→cancelled, late Stripe payment on cancelled→not re-confirmed, Cal CREATED unknown event type→ignored, bad JSON→400, missing id→400.
- Visual QA (Playwright fallback, agent-desktop blocked): /book, /book (wellness tab), /book/[slug] details + validation errors, test checkout, /booking/[code], /manage/[code], cancel dialog, /manage, /gift-cards, /gift-cards/success at 1440 and 390; flow clicked end to end at both widths. Screenshots: scratchpad/booking-agent/shots/.

## 7. Shared-code asks (report only, do not edit)
- service.ts createBooking cancelUrl `/book/[slug]?cancelled=CODE` carries no token, so anyone who knows a code can release a pending hold (and expire its Stripe session). Low risk (6-char random code, only shown to the guest). Suggest adding `&t=${manageToken}`; /book/[slug] would then verify it.
- service.ts fulfillBooking: the late-payment guard is fixed (refundLatePayment). Confirmed with an unsigned webhook replay.
- availability: a month query took 4-9s on the loaded dev server (2 queries + pure compute, so it's load, not N+1). Worth checking again on a quiet machine.
- .gitignore: e2e output goes to .data/e2e-results (already ignored), so no change needed.
- notify.ts sendManageLinks is implemented (automation), and /manage calls it.
- Schema: GiftCardStatus has no "expired"; abandoned gift-card checkouts → "void".
