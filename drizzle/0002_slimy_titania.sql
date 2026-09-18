CREATE TYPE "public"."settlement_status" AS ENUM('none', 'release_pending', 'refund_pending', 'released', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."stripe_event_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "settlement_status" "settlement_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "settlement_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "settlement_last_error" text;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "settlement_next_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "subject_artist_id" uuid;--> statement-breakpoint
UPDATE "reviews" AS r
SET "subject_artist_id" = (
  SELECT cp."artist_id"
  FROM "collaboration_participants" cp
  WHERE cp."collaboration_id" = r."collaboration_id"
    AND cp."artist_id" <> r."author_artist_id"
  LIMIT 1
);--> statement-breakpoint
DELETE FROM "reviews" WHERE "subject_artist_id" IS NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "subject_artist_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "status" "stripe_event_status" DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "lease_until" timestamp;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "attempts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "last_error" text;--> statement-breakpoint
-- Pre-lease rows were treated as done once inserted; mark them completed so a
-- retry cannot re-apply side effects that already ran under the old handler.
UPDATE "stripe_events"
SET "status" = 'completed',
    "completed_at" = COALESCE("completed_at", "received_at")
WHERE "status" = 'processing' AND "lease_until" IS NULL AND "completed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_artist_id_artist_profiles_id_fk" FOREIGN KEY ("subject_artist_id") REFERENCES "public"."artist_profiles"("id") ON DELETE cascade ON UPDATE no action;
