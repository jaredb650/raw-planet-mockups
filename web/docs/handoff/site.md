# Handoff: public marketing site (site agent)

Brief: build the public site under `src/app/(site)/**`, `src/components/site/**`, `src/content/site.ts`,
API routes `api/inquiries`, `api/events/[slug]/rsvp`, `api/reviews`, plus `not-found.tsx`, `sitemap.ts`,
`robots.ts`, `opengraph-image.tsx`, `icon.svg` in `src/app/`. Design = `/mockups/3-open-door/index.html`
layout with brand tokens from `globals.css`. Don't edit shared files (schema, lib/booking, lib/email,
lib/queries/public.ts, globals.css, app/layout.tsx). Dev server already on :3300; never touch the DB directly.

## 1. Done (written, NOT yet typechecked or viewed)
- `src/content/site.ts`: slogans, MOODS (chooser copy by theme), WORRIES, HOST bio, FAQ (+categories, `{{cancellation}}`/`{{maxGuests}}` tokens).
- `src/components/site/`:
  - `format.ts` (price/duration/group labels, quickFacts), `media.ts` (curated photos per theme, loop/reel videos, SITE_MEDIA),
  - `faq.ts` (resolveFaq fills tokens from DB), `JsonLd.tsx`, `schema.ts` (business/product/event/breadcrumb JSON-LD),
  - `queries.ts` (server-only: getExperienceRating, getReviewForBooking, getExperienceSummary),
  - `Logo.tsx`, `nav.ts`, `SiteHeader.tsx`(+css, client, mobile menu), `SiteFooter.tsx`(+css),
  - `Stars.tsx`(+css, Stars + RatingBadge), `ReviewCard.tsx`(+css), `FaqList.tsx`(+css, details/summary),
  - `LoopVideo.tsx`(+css, IO-driven autoplay, reduced-motion, pause btn), `ReelPlayer.tsx`(+css, controls, preload none),
  - `Gallery.tsx`(+css, mosaic + <dialog> lightbox, arrows/swipe),
  - `BookingSlot.tsx`(+css) TEMPORARY fallback for BookingWidget (see 5),
  - `MoodContext.tsx` (MoodProvider sets data-theme; PickExperienceLink), `HomeBooking.tsx`, `MoodIcons.tsx`, `MoodChooser.tsx`(+css),
  - `ExperienceRow.tsx`(+css, alternating rows), `EventCard.tsx`(+css, DateBlock, spotsLabel), `AddToCalendar.tsx` (Google + `/events/[slug]/calendar.ics`).
- `src/app/(site)/layout.tsx` (force-dynamic, header/footer, skip link) + `site.module.css`.

- Home page DONE (written): `src/app/(site)/page.tsx` + `home.module.css` (hero, mood chooser, rows, worries, host, reviews + meditation reel, #book powder strip w/ HomeBooking, gift/group cards, community events, home FAQ, business JSON-LD). GET / returns 200 but NOT yet visually checked.

## 2. In progress (paused at coordinator's request)
- `npx tsc --noEmit`: no errors in my source files; only 2 errors in generated `.next/types/validator.ts` (stale route types: missing `src/app/page.js`, `__InvalidParamMatchingKeys`). Re-check after the dev server regenerates types; the pipe through head hid the real exit code.
- No file is half-written.

Skills applied from session 2 (coordinator): ponytail (full: smallest complete change, never dropping briefed features), frontend-design (polish; Open Door mockup + globals.css tokens win on conflicts), context-optimization (scoped agent-desktop snapshots, one screenshot at a time), ponytail-review on my diff before the final report.

## 3. Next steps (in order)
0. (DONE, session 2) Home screenshotted at 1440/390 and fixed: hero title now 2 lines (font capped so each slogan fits), neutral brick theme until a mood is picked (`MoodProvider initialPicked`), CSS-module `.lede`/`.eyebrow` selectors now `:global(...)` (worries lede contrast), lead review trimmed with `pullQuote()` (format.ts) + "Read the full review" anchor (`ReviewCard` has `id=review-<id>`), 4 quotes in 2x2, "Read all reviews" under the title, "Three rooms / Three ways in" no widow, event card actions = RSVP + "On Meetup ↗" (compact keeps side date block on phones), footer language pill on its own line, footer contact column full-width on phones.
   - QA tool switch (coordinator, session 2): visual checks now use the `agent-desktop` CLI on my own Chrome (`--user-data-dir=<scratchpad>/site-agent/chrome-profile`), env `AGENT_DESKTOP_SESSION=run-1793813905198-52218-0 AGENT_DESKTOP_AGENT_ID=site`, always `--window-id`, headless only. No new Playwright screenshot scripts. Home was the last page checked with Playwright (`scratchpad/site-agent/shots/home-*.png`).
1. (DONE) Home `(site)/page.tsx` (+ `home.module.css`): hero "Make it loud. Make it yours." (SITE_MEDIA.heroMain + heroSnap polaroid + "No experience needed" sticker, rating from getRatingSummary), mood chooser (#mood, wrapped in MoodProvider with initial slug from `?experience=`), experience rows (#experiences, pickable), "But I'm not musical" (WORRIES, cocoa bg), host section (sticker "Hablamos español"), reviews (featured lead + 3 + meditation reel video), #book powder strip ("Find your time" / "Two hours to lose track." + HomeBooking), gift (/gift-cards) + group (/groups) cards, community events (getUpcomingEvents(3), Meetup CTA via BUSINESS.meetupGroupUrl), FAQ (home: true entries), business JSON-LD.
2. (DONE, session 2; 200/404 verified, visual QA pending) `experiences/[slug]/page.tsx`: gallery, description, highlights, includes, good-to-know, reel video (production.mp4 / meditation.mp4), reviews for experience, FAQ, location area, sticky price box (desktop) + sticky bottom bar (mobile), #book BookingSlot(initialSlug, compact), Product JSON-LD (aggregateRating only from getExperienceRating; overall summary for music-production), generateMetadata. Also `experiences/page.tsx` index.
3. (DONE, session 2; 200 + .ics verified, visual QA pending) `events/page.tsx`, `events/[slug]/page.tsx` (RsvpForm client → POST /api/events/[slug]/rsvp; Event JSON-LD), `events/[slug]/calendar.ics/route.ts` (buildIcs from lib/ics).
4. (DONE, session 2; curl-tested: 422 field errors, honeypot, 201 create, idempotent re-RSVP, 404, cross-origin 403, bad review token 403. Test rows left in dev DB: RSVP + inquiry from site-qa@example.com) API: `api/inquiries/route.ts` (zod, honeypot `website`, insert inquiries, `await sendInquiryEmails(id)`), `api/events/[slug]/rsvp/route.ts` (tx + `pg_advisory_xact_lock(hashtext('rp:event:'||id))`, capacity, unique email, `sendEventRsvp`), `api/reviews/route.ts` (verify getBookingForCustomer(code, token), one per booking, insert source direct / status pending).
5. (DONE, session 2; all 200, visual QA pending) `groups`, `faq` (FAQPage JSON-LD + client search FaqSearch), `contact`, `policies` (cancellationHours per experience, MAX_CUSTOMER_RESCHEDULES from service, terms/privacy marked as template), `about`, `reviews` (filter `?experience=`), `review/[code]` (StarRatingInput + ReviewForm, thank-you state).
6. (DONE, session 2; 404/200 verified, OG image rendered and checked) `app/not-found.tsx` (render SiteHeader/Footer itself; outside (site) layout), `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, `icon.svg`.
7. (DONE, session 2: clean; + tests/unit/site.test.ts 5/5 for pullQuote + reviewEligibility) `npx tsc --noEmit`, `npx eslint src/components/site "src/app/(site)" src/app/api/{inquiries,events,reviews} src/content/site.ts`.
8. Visual QA. agent-desktop (primary) was blocked the whole session: every window-scoped command (resize/move/screenshot/snapshot --window-id w-31704) timed out with global_window_owner_churn / APP_UNRESPONSIVE, including 30 retries after the coordinator closed a stray prompt. Per the user's decision I fell back to headless Playwright (scripts in scratchpad/site-agent: shot.cjs full-page + overflow scan, slice.py/grid.py for viewing, flows.cjs click-throughs, qa-final.cjs doc-width sweep; each closes its browser in `finally`, run one at a time). Pages reviewed by eye at 1440 and 390: home, experiences, music-production, sound-meditation, events, groups, faq, contact, policies (1440), about (1440), reviews (1440). Fixes from that pass: experiences compare table sr-only spans escaped the scroller (doc width 565 at 390) → scroller `position: relative` (same on policies table); events header image collapsed to 0 width on phones; price box said "From $150 per guest / per guest"; facts grid orphan cell; mobile price box moved after content; wellness #book heading no longer says "Two hours…"; form rows align-items:start; reviews lede spacing; removed "add guests" claim (manage flow only moves/cancels).
   - Flows (Playwright, flows.cjs, all PASS, no page errors): header nav, mood chooser → re-themes + widget selects DJ, mobile menu open/Escape, FAQ search (match / none / clear), gallery lightbox open/ArrowRight/Escape, phone sticky bar shows mid-page and hides over #book, RSVP validation + success, group request preselect + success, reviews filter chip, review page bad token. qa-final.cjs: every page 200 (404 page 404) with doc width = viewport at 1440 and 390.
   - Not re-captured after the last fixes (event date row stacking on phones, Add-to-calendar button size in event hero); low risk, CSS only.
   - ponytail-review pass done: breadcrumbs merged into `PageHeader#Breadcrumbs` (3 copies removed), unused `StickyBookBar.watchIds` and `InquiryForm.kinds` options deleted, unit tests added.
   - Cleanup (coordinator, memory pressure): killed my capture batch + Chrome, deleted chrome-profile, slices, OG test files (231M → 22M). Never run two browsers at once.
9. (DONE, session 2) BookingSlot now renders the real `BookingWidget` (fallback CSS deleted). Home #book: full widget, follows mood pick via key remount; experience pages: `compact` + initialSlug.

## 4. Files created
All files listed in section 1, plus (session 2): `components/site/{PageHeader,StickyBookBar,RsvpForm}.tsx` (+css), `Forms.module.css`, `server/api.ts` (json/fail/sameOrigin/rate limit/readBody), `queries.ts#reviewEligibility`, `format.ts#pullQuote`, `content/site.ts` (PERFECT_FOR, SESSION_FLOW_TITLE, EXPERIENCE_FAQ), `(site)/experiences/{page,[slug]/page}.tsx`, `(site)/events/{page,[slug]/page,[slug]/calendar.ics/route}.ts(x)`, `api/{inquiries,events/[slug]/rsvp,reviews}/route.ts`. nav "Experiences" now → /experiences. No shared files edited.

## 5. Contracts
- Media: `src/content/media.ts` + `public/media/**` exist and are wired via `components/site/media.ts`.
- BookingWidget: wired in through `BookingSlot.tsx` (thin wrapper).
- Emails: will call `sendInquiryEmails`, `sendEventRsvp` (currently no-op stubs in notify.ts).

## 6. Known issues / shared changes needed
- Shared asks (orchestrator): unique index on `reviews.booking_id` (API uses an advisory lock meanwhile); optionally move `components/site/queries.ts` helpers into `lib/queries/public.ts`; delete `src/app/favicon.ico` (create-next-app default) so `icon.svg` is the only icon; set `MEETUP_GROUP_URL` (home/events "Follow on Meetup" buttons hide without it).
- Client content: real guest video testimonials (meditation) don't exist yet; /reviews and experience pages show the existing reels with honest captions + a "share your story" ask. Terms/Privacy are marked template; "if we have to cancel → new time or full refund" line needs Alex's OK.
- Dev DB test rows: RSVPs + inquiries from site-qa@example.com and flow-qa*@example.com.

## 7. Verification
Planned script dir: `/private/tmp/claude-501/-Users-jaredbeguelin-code-RawPlanet/eb610c9f-2021-4ad3-9a17-747e61344f9b/scratchpad/site-agent/` (Playwright from web/node_modules, base http://localhost:3300). No screenshots yet.
