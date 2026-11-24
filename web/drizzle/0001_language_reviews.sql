ALTER TABLE "event_rsvps" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");