CREATE TYPE "public"."feat_status" AS ENUM('open', 'selective', 'closed');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('fixed', 'starting_from', 'offer');--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "artist_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "genres" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "influences" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "spotify_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "apple_music_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "soundcloud_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "youtube_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "instagram_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "tiktok_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "featured_track_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "feat_status" "feat_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "collaboration_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "pricing_mode" "pricing_mode" DEFAULT 'starting_from' NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
-- Seed genres array from legacy single genre for existing rows.
UPDATE "artist_profiles"
SET "genres" = jsonb_build_array("genre")
WHERE "genres" = '[]'::jsonb AND "genre" IS NOT NULL AND "genre" <> '';--> statement-breakpoint
-- Open + trade already true → seed swap into collaboration types for filter compatibility.
UPDATE "artist_profiles"
SET "collaboration_types" = '["swap"]'::jsonb
WHERE "trade" = true AND "collaboration_types" = '[]'::jsonb;
