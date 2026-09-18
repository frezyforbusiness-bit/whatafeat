CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "stripe_payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "platform_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "stripe_transfer_group" text;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "stripe_transfer_id" text;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "released_at" timestamp;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "stripe_refund_id" text;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "refunded_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "collab_checkout_session_uidx" ON "collaborations" USING btree ("stripe_checkout_session_id");