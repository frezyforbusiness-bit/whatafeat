import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const modeEnum = pgEnum("collaboration_mode", ["Paid", "Trade"]);
export const verseStatusEnum = pgEnum("verse_status", ["Draft", "Published", "Closed"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "Submitted",
  "Shortlisted",
  "Selected",
  "Rejected",
  "Withdrawn",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "Draft",
  "Sent",
  "Accepted",
  "Declined",
  "Withdrawn",
  "Expired",
]);
export const collaborationStatusEnum = pgEnum("collaboration_status", [
  "Awaiting payment",
  "Active",
  "Completed",
  "Cancelled",
]);
export const contributionStatusEnum = pgEnum("contribution_status", [
  "Pending",
  "Delivered",
  "Revision requested",
  "Approved",
]);
export const assetVisibilityEnum = pgEnum("asset_visibility", ["public", "private"]);

/** Auth.js / NextAuth tables */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: text("role").notNull().default("artist"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const artistProfiles = pgTable(
  "artist_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    bio: text("bio").notNull().default(""),
    genre: text("genre").notNull().default("Rap"),
    language: text("language").notNull().default("English"),
    trade: boolean("trade").notNull().default(true),
    priceCents: integer("price_cents").notNull().default(10000),
    deliveryDays: integer("delivery_days").notNull().default(7),
    hasDemo: boolean("has_demo").notNull().default(false),
    avatarAssetId: uuid("avatar_asset_id"),
    artIndex: integer("art_index").notNull().default(0),
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    /** Stripe Connect Express account that receives payouts for paid work. */
    stripeAccountId: text("stripe_account_id"),
    /** Mirrors charges_enabled && payouts_enabled from account.updated. */
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("artist_slug_uidx").on(t.slug)],
);

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  pathname: text("pathname").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  visibility: assetVisibilityEnum("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const audioSamples = pgTable("audio_samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  durationMs: integer("duration_ms").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const featureOffers = pgTable("feature_offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  mode: modeEnum("mode").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  days: integer("days").notNull().default(7),
  revisions: integer("revisions").notNull().default(2),
  files: text("files").notNull().default("Dry WAV vocals + wet reference mix"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const openVerses = pgTable("open_verses", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  brief: text("brief").notNull(),
  genre: text("genre").notNull(),
  language: text("language").notNull(),
  mode: modeEnum("mode").notNull(),
  budgetCents: integer("budget_cents").notNull().default(0),
  bpm: integer("bpm").notNull().default(120),
  key: text("key").notNull().default("A minor"),
  artIndex: integer("art_index").notNull().default(0),
  status: verseStatusEnum("status").notNull().default("Draft"),
  previewAssetId: uuid("preview_asset_id").references(() => assets.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    verseId: uuid("verse_id")
      .notNull()
      .references(() => openVerses.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    status: applicationStatusEnum("status").notNull().default("Submitted"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("application_verse_artist_active_uidx").on(t.verseId, t.artistId)],
);

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromArtistId: uuid("from_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  toArtistId: uuid("to_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  payerArtistId: uuid("payer_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  performerArtistId: uuid("performer_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  verseId: uuid("verse_id").references(() => openVerses.id),
  applicationId: uuid("application_id").references(() => applications.id),
  terms: jsonb("terms").notNull(),
  status: proposalStatusEnum("status").notNull().default("Sent"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});

export const collaborations = pgTable(
  "collaborations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" })
      .unique(),
    payerArtistId: uuid("payer_artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    agreement: jsonb("agreement").notNull(),
    status: collaborationStatusEnum("status").notNull(),
    cancelByArtistId: uuid("cancel_by_artist_id").references(() => artistProfiles.id),
    acceptedAt: timestamp("accepted_at", { mode: "date" }).defaultNow().notNull(),

    // --- Escrow payment state (Stripe Connect) ---
    /** Amount the payer owes, frozen at acceptance so later edits cannot move it. */
    amountCents: integer("amount_cents").notNull().default(0),
    /** Platform commission withheld from the transfer to the performer. */
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /** Ties the charge and the later payout together for reconciliation. */
    stripeTransferGroup: text("stripe_transfer_group"),
    /** Set by the webhook, not by the browser. */
    paidAt: timestamp("paid_at", { mode: "date" }),
    /** Written when the approved work is released from escrow. */
    stripeTransferId: text("stripe_transfer_id"),
    releasedAt: timestamp("released_at", { mode: "date" }),
    stripeRefundId: text("stripe_refund_id"),
    refundedAt: timestamp("refunded_at", { mode: "date" }),
  },
  (t) => [uniqueIndex("collab_checkout_session_uidx").on(t.stripeCheckoutSessionId)],
);

/**
 * Processed Stripe webhook ids. Stripe retries deliveries, so every handler
 * inserts here first and bails out if the row already exists.
 */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { mode: "date" }).defaultNow().notNull(),
});

export const collaborationParticipants = pgTable(
  "collaboration_participants",
  {
    collaborationId: uuid("collaboration_id")
      .notNull()
      .references(() => collaborations.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.collaborationId, t.artistId] })],
);

export const contributions = pgTable("contributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  collaborationId: uuid("collaboration_id")
    .notNull()
    .references(() => collaborations.id, { onDelete: "cascade" }),
  performerArtistId: uuid("performer_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  recipientArtistId: uuid("recipient_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  obligation: text("obligation").notNull(),
  status: contributionStatusEnum("status").notNull().default("Pending"),
  revisionsUsed: integer("revisions_used").notNull().default(0),
  deadlineAt: timestamp("deadline_at", { mode: "date" }),
});

export const deliveries = pgTable("deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  contributionId: uuid("contribution_id")
    .notNull()
    .references(() => contributions.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  authorArtistId: uuid("author_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const deliveryFiles = pgTable("delivery_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  proposalId: uuid("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  authorArtistId: uuid("author_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const blocks = pgTable(
  "blocks",
  {
    blockerArtistId: uuid("blocker_artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    blockedArtistId: uuid("blocked_artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.blockerArtistId, t.blockedArtistId] })],
);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorArtistId: uuid("author_artist_id")
    .notNull()
    .references(() => artistProfiles.id, { onDelete: "cascade" }),
  target: text("target").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collaborationId: uuid("collaboration_id")
      .notNull()
      .references(() => collaborations.id, { onDelete: "cascade" }),
    authorArtistId: uuid("author_artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("review_collab_author_uidx").on(t.collaborationId, t.authorArtistId)],
);
