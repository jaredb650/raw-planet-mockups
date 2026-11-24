CREATE TABLE "addons" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"experience_id" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"pricing" text DEFAULT 'per_booking' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"resource_group" text DEFAULT 'alex' NOT NULL,
	"experience_id" text,
	"reason" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"feed_id" text,
	"external_uid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_addons" (
	"booking_id" text NOT NULL,
	"addon_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	CONSTRAINT "booking_addons_booking_id_addon_id_pk" PRIMARY KEY("booking_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"booking_id" text NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"code" text NOT NULL,
	"experience_id" text NOT NULL,
	"customer_id" text,
	"status" text NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"source" text DEFAULT 'direct' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"guests" integer NOT NULL,
	"resource_group" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"language" text DEFAULT 'en' NOT NULL,
	"customer_notes" text DEFAULT '' NOT NULL,
	"internal_notes" text DEFAULT '' NOT NULL,
	"occasion" text,
	"currency" text DEFAULT 'usd' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"addons_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"gift_card_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"amount_paid_cents" integer DEFAULT 0 NOT NULL,
	"amount_refunded_cents" integer DEFAULT 0 NOT NULL,
	"promo_code_id" text,
	"gift_card_id" text,
	"is_gift" boolean DEFAULT false NOT NULL,
	"gift_recipient_name" text,
	"gift_recipient_email" text,
	"gift_message" text,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"cal_booking_uid" text,
	"cal_reservation_uid" text,
	"external_ref" text,
	"hold_expires_at" timestamp with time zone,
	"manage_token" text NOT NULL,
	"deliverable_status" text DEFAULT 'none' NOT NULL,
	"deliverable_url" text,
	"confirmation_sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"followup_sent_at" timestamp with time zone,
	"review_request_sent_at" timestamp with time zone,
	"abandoned_email_sent_at" timestamp with time zone,
	"rescheduled_from_id" text,
	"reschedule_count" integer DEFAULT 0 NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"cancelled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "calendar_feeds" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"resource_group" text DEFAULT 'alex' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"language" text DEFAULT 'en' NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"template" text NOT NULL,
	"booking_id" text,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"html" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_rsvps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"guests" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'going' NOT NULL,
	"stripe_checkout_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"image_url" text,
	"meetup_url" text,
	"external_ticket_url" text,
	"rsvp_enabled" boolean DEFAULT true NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"capacity" integer,
	"series_id" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"theme" text DEFAULT 'production' NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"good_to_know" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing_mode" text DEFAULT 'per_person' NOT NULL,
	"duration_options" jsonb NOT NULL,
	"included_guests" integer DEFAULT 1 NOT NULL,
	"extra_guest_cents" integer DEFAULT 0 NOT NULL,
	"min_guests" integer DEFAULT 1 NOT NULL,
	"max_guests" integer DEFAULT 6 NOT NULL,
	"min_age" integer,
	"resource_group" text DEFAULT 'alex' NOT NULL,
	"schedule" jsonb NOT NULL,
	"slot_step_minutes" integer DEFAULT 120 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"lead_time_hours" integer DEFAULT 12 NOT NULL,
	"max_advance_days" integer DEFAULT 120 NOT NULL,
	"cancellation_hours" integer DEFAULT 24 NOT NULL,
	"location_area" text DEFAULT 'New York, NY' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"arrival_instructions" text DEFAULT '' NOT NULL,
	"cal_event_type_id" integer,
	"airbnb_url" text,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiences_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gift_card_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"gift_card_id" text NOT NULL,
	"booking_id" text,
	"amount_cents" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"code" text NOT NULL,
	"initial_cents" integer NOT NULL,
	"balance_cents" integer NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"purchaser_name" text NOT NULL,
	"purchaser_email" text NOT NULL,
	"recipient_name" text,
	"recipient_email" text,
	"message" text,
	"deliver_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"issued_by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"experience_id" text,
	"preferred_date" text,
	"group_size" integer,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"experience_ids" jsonb,
	"min_subtotal_cents" integer DEFAULT 0 NOT NULL,
	"max_redemptions" integer,
	"redemptions" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"booking_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"stripe_refund_id" text,
	"gift_card_cents" integer DEFAULT 0 NOT NULL,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"booking_id" text,
	"experience_id" text,
	"name" text NOT NULL,
	"location" text,
	"rating" integer NOT NULL,
	"body" text NOT NULL,
	"source" text DEFAULT 'direct' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"host_reply" text,
	"review_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"experience_id" text NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"guests" integer DEFAULT 1 NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_feed_id_calendar_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."calendar_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_range_idx" ON "blocks" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_email_idx" ON "bookings" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "bookings_stripe_session_idx" ON "bookings" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "bookings_cal_uid_idx" ON "bookings" USING btree ("cal_booking_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_log_booking_idx" ON "email_log" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_rsvps_event_email_idx" ON "event_rsvps" USING btree ("event_id","email");