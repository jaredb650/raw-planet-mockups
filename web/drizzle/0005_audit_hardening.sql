DELETE FROM "refunds" a USING "refunds" b
WHERE a."id" > b."id"
  AND a."stripe_refund_id" IS NOT NULL
  AND a."stripe_refund_id" = b."stripe_refund_id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_stripe_id_uidx"
  ON "refunds" USING btree ("stripe_refund_id")
  WHERE "refunds"."stripe_refund_id" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "blocks" a USING "blocks" b
WHERE a."id" > b."id"
  AND a."feed_id" IS NOT NULL
  AND a."external_uid" IS NOT NULL
  AND a."feed_id" = b."feed_id"
  AND a."external_uid" = b."external_uid";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blocks_feed_ext_uidx"
  ON "blocks" USING btree ("feed_id", "external_uid")
  WHERE "blocks"."feed_id" IS NOT NULL AND "blocks"."external_uid" IS NOT NULL;
