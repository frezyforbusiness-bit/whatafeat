"use server";

import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { head } from "@vercel/blob";
import { getDb } from "@/db";
import {
  applications,
  artistProfiles,
  assets,
  audioSamples,
  blocks,
  collaborationParticipants,
  collaborations,
  contributions,
  deliveries,
  deliveryFiles,
  featureOffers,
  messages,
  openVerses,
  proposals,
  reports,
  reviews,
} from "@/db/schema";
import type { Terms } from "@/domain/model";
import { paymentsEnabled } from "@/lib/flags";
import { assertPaymentsReady } from "@/lib/payment-decisions";
import { assertRateLimit } from "@/lib/rate-limit";
import { captureException } from "@/lib/monitoring";
import {
  assertDeliveryFile,
  assertDemoFile,
  assertOwnedBlobPath,
  recordAsset,
} from "@/server/blob";
import {
  createCheckoutSession,
  enqueueRefund,
  enqueueRelease,
  ensureConnectAccount,
  expireOpenCheckout,
  refundCollaboration,
  releaseEscrow,
  syncConnectStatus,
} from "@/server/payments";
import { stripeConfigured } from "@/server/stripe";
import { requireArtist, requireOnboardedArtist } from "@/server/session";
import { loadCatalogStore } from "@/server/catalog";
import {
  applicationStatusSchema,
  applySchema,
  contributionSchema,
  onboardingSchema,
  parseOrThrow,
  proposalActionSchema,
  reviewSchema,
  saveOfferSchema,
  saveVerseSchema,
  sendProposalSchema,
  verseStatusSchema,
} from "@/server/validation";

function revalidateApp() {
  revalidatePath("/", "layout");
}

const toCents = (euros: number) => Math.round(euros * 100);

/**
 * Marks lapsed proposals Expired and releases the applications they reserved.
 *
 * This runs as its own committed transaction. The previous implementation wrote
 * the Expired row and then threw inside the same transaction, so the rollback
 * discarded the update and the candidate stayed locked in `Selected` forever.
 */
async function expireStaleProposals() {
  const db = getDb();
  await db.transaction(async (tx) => {
    // Atomic status flip: only Sent rows become Expired, so a concurrent accept
    // that already moved the row cannot be overwritten by the expirer.
    const stale = await tx
      .update(proposals)
      .set({ status: "Expired" })
      .where(and(eq(proposals.status, "Sent"), sql`${proposals.expiresAt} <= now()`))
      .returning({ id: proposals.id, applicationId: proposals.applicationId });
    if (!stale.length) return;

    const appIds = stale.map((s) => s.applicationId).filter((x): x is string => !!x);
    if (appIds.length) {
      await tx
        .update(applications)
        .set({ status: "Submitted" })
        .where(and(inArray(applications.id, appIds), eq(applications.status, "Selected")));
    }
  });
}

/** Serialises concurrent writers on one row for the rest of the transaction. */
async function lockRow(
  tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> },
  table: "collaborations" | "open_verses" | "proposals",
  id: string,
) {
  const query =
    table === "collaborations"
      ? sql`select id from collaborations where id = ${id} for update`
      : table === "open_verses"
        ? sql`select id from open_verses where id = ${id} for update`
        : sql`select id from proposals where id = ${id} for update`;
  await tx.execute(query);
}

export async function getProdBootstrap() {
  const { auth } = await import("@/auth");
  const session = await auth();
  const artistId = session?.user?.artistId;
  await expireStaleProposals();
  const store = await loadCatalogStore(artistId);

  // Whether this artist can currently receive money, so the UI can prompt for
  // Connect onboarding before they publish paid offers.
  let payoutsEnabled = false;
  if (artistId) {
    const db = getDb();
    const [profile] = await db
      .select({ enabled: artistProfiles.stripePayoutsEnabled })
      .from(artistProfiles)
      .where(eq(artistProfiles.id, artistId))
      .limit(1);
    payoutsEnabled = profile?.enabled ?? false;
  }

  return {
    store,
    account: artistId ?? null,
    onboardingComplete: session?.user?.onboardingComplete ?? false,
    userEmail: session?.user?.email ?? null,
    paymentsEnabled: paymentsEnabled() && stripeConfigured(),
    payoutsEnabled,
  };
}

export async function completeOnboarding(input: unknown) {
  const data = parseOrThrow(onboardingSchema, input);
  const { profile } = await requireArtist();
  const db = getDb();
  const clash = await db
    .select({ id: artistProfiles.id })
    .from(artistProfiles)
    .where(and(eq(artistProfiles.slug, data.slug), ne(artistProfiles.id, profile.id)))
    .limit(1);
  if (clash.length) throw new Error("That slug is already in use.");
  await db
    .update(artistProfiles)
    .set({
      name: data.name,
      slug: data.slug,
      bio: data.bio ?? "",
      genre: data.genre,
      language: data.language,
      trade: data.trade,
      onboardingComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(artistProfiles.id, profile.id));
  revalidateApp();
  return { ok: true };
}

export async function updateProfile(input: unknown) {
  return completeOnboarding(input);
}

/**
 * Records a profile demo that the browser already uploaded straight to Blob.
 *
 * Ownership and size/MIME come from Blob `head()`, never from a parallel client
 * pathname field — otherwise a caller who knows another object's URL could
 * register it under their own prefix.
 */
export async function recordProfileDemo(input: { pathname: string; url: string; name: string }) {
  const { session, profile } = await requireOnboardedArtist();
  const meta = await head(input.url);
  assertOwnedBlobPath(meta, { userId: session.user.id, kind: "demo" });
  assertDemoFile(meta.contentType ?? "", meta.size);

  const asset = await recordAsset({
    userId: session.user.id,
    blobUrl: meta.url ?? input.url,
    pathname: meta.pathname,
    mime: meta.contentType ?? "application/octet-stream",
    size: meta.size,
    visibility: "public",
  });

  const db = getDb();
  await db.insert(audioSamples).values({
    profileId: profile.id,
    title: input.name.slice(0, 200),
    assetId: asset.id,
    sortOrder: 0,
  });
  await db
    .update(artistProfiles)
    .set({ hasDemo: true, updatedAt: new Date() })
    .where(eq(artistProfiles.id, profile.id));
  revalidateApp();
  return { assetId: asset.id };
}

export async function saveOffer(input: unknown) {
  const data = parseOrThrow(saveOfferSchema, input);
  const { profile } = await requireOnboardedArtist();
  if (!profile.hasDemo) throw new Error("Add a profile demo before publishing an offer.");
  if (data.mode === "Paid") {
    assertPaymentsReady({
      paymentsEnabled: paymentsEnabled(),
      stripeConfigured: stripeConfigured(),
    });
    if (!profile.stripePayoutsEnabled) {
      throw new Error("Finish payout setup in Settings before publishing paid offers.");
    }
  }
  const db = getDb();
  const values = {
    title: data.title,
    mode: data.mode,
    priceCents: data.mode === "Trade" ? 0 : toCents(data.price),
    days: data.days,
    revisions: data.revisions,
    files: data.files,
  };
  if (data.id) {
    await db
      .update(featureOffers)
      .set(values)
      .where(and(eq(featureOffers.id, data.id), eq(featureOffers.artistId, profile.id)));
  } else {
    await db.insert(featureOffers).values({ artistId: profile.id, ...values });
  }
  revalidateApp();
  return { ok: true };
}

export async function toggleOfferArchive(offerId: string) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const [row] = await db
    .select()
    .from(featureOffers)
    .where(and(eq(featureOffers.id, offerId), eq(featureOffers.artistId, profile.id)))
    .limit(1);
  if (!row) throw new Error("Offer not found.");
  await db
    .update(featureOffers)
    .set({ archived: !row.archived })
    .where(eq(featureOffers.id, offerId));
  revalidateApp();
}

export async function saveOpenVerse(input: unknown) {
  const data = parseOrThrow(saveVerseSchema, input);
  const { profile } = await requireOnboardedArtist();
  if (data.status === "Published" && !profile.hasDemo) {
    throw new Error("Add a profile demo before publishing.");
  }
  const db = getDb();

  // Prefer an explicit profile demo as the verse preview so Live never falls
  // back to a synthetic WAV for published announcements.
  let previewAssetId: string | null = null;
  if (data.status === "Published") {
    const [sample] = await db
      .select({ assetId: audioSamples.assetId })
      .from(audioSamples)
      .where(eq(audioSamples.profileId, profile.id))
      .orderBy(audioSamples.sortOrder)
      .limit(1);
    previewAssetId = sample?.assetId ?? null;
  }

  const values = {
    title: data.title,
    brief: data.brief,
    genre: data.genre,
    language: data.language,
    mode: data.mode,
    budgetCents: data.mode === "Paid" ? toCents(data.price) : 0,
    bpm: data.bpm,
    key: data.key,
    ...(previewAssetId ? { previewAssetId } : {}),
  };
  if (data.id) {
    const [existing] = await db
      .select()
      .from(openVerses)
      .where(and(eq(openVerses.id, data.id), eq(openVerses.ownerId, profile.id)))
      .limit(1);
    if (!existing) throw new Error("Access denied.");
    if (existing.status === "Closed") throw new Error("This announcement is closed.");
    await db
      .update(openVerses)
      .set({ ...values, status: data.status === "Closed" ? "Closed" : data.status })
      .where(eq(openVerses.id, data.id));
  } else {
    await db.insert(openVerses).values({
      ownerId: profile.id,
      ...values,
      artIndex: profile.artIndex,
      status: data.status,
    });
  }
  revalidateApp();
}

/** Publish / close an announcement from the Studio list. */
export async function setOpenVerseStatus(verseId: string, status: unknown) {
  const next = parseOrThrow(verseStatusSchema, status);
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const [verse] = await db
    .select()
    .from(openVerses)
    .where(and(eq(openVerses.id, verseId), eq(openVerses.ownerId, profile.id)))
    .limit(1);
  if (!verse) throw new Error("Access denied.");
  if (verse.status === "Closed") throw new Error("This announcement is closed.");
  if (next === "Published" && !profile.hasDemo) {
    throw new Error("Add a demo before publishing.");
  }
  await db.update(openVerses).set({ status: next }).where(eq(openVerses.id, verseId));
  revalidateApp();
}

export async function applyToVerse(input: unknown) {
  const data = parseOrThrow(applySchema, input);
  const { profile } = await requireOnboardedArtist();
  if (!profile.hasDemo) throw new Error("Add a demo to your profile first.");
  const db = getDb();
  const [verse] = await db
    .select()
    .from(openVerses)
    .where(eq(openVerses.id, data.verseId))
    .limit(1);
  if (!verse || verse.status !== "Published") throw new Error("This announcement is not open.");
  if (verse.ownerId === profile.id) throw new Error("You cannot apply to your own announcement.");

  const blocked = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.blockerArtistId, verse.ownerId), eq(blocks.blockedArtistId, profile.id)))
    .limit(1);
  if (blocked.length) throw new Error("This artist is blocked.");

  const priceCents = toCents(data.price ?? verse.budgetCents / 100);

  // A (verse, artist) pair is unique even after withdrawal, so reuse the existing
  // row instead of inserting a duplicate that would trip the constraint.
  const [existing] = await db
    .select()
    .from(applications)
    .where(
      and(eq(applications.verseId, data.verseId), eq(applications.artistId, profile.id)),
    )
    .limit(1);

  if (existing) {
    if (existing.status !== "Withdrawn") throw new Error("You already have an active application.");
    await db
      .update(applications)
      .set({ message: data.message, priceCents, status: "Submitted", createdAt: new Date() })
      .where(eq(applications.id, existing.id));
  } else {
    await db.insert(applications).values({
      verseId: data.verseId,
      artistId: profile.id,
      message: data.message,
      priceCents,
      status: "Submitted",
    });
  }
  revalidateApp();
}

export async function sendProposalAction(input: unknown) {
  const data = parseOrThrow(sendProposalSchema, input);
  const { profile } = await requireOnboardedArtist();
  await assertRateLimit("proposal", `artist:${profile.id}`);
  const db = getDb();
  if (profile.id === data.toArtistId) throw new Error("You cannot propose to yourself.");

  await expireStaleProposals();

  if (data.offerId) {
    const [offer] = await db
      .select()
      .from(featureOffers)
      .where(and(eq(featureOffers.id, data.offerId), eq(featureOffers.archived, false)))
      .limit(1);
    if (!offer) throw new Error("This offer is no longer available.");
  }

  const blocked = await db
    .select()
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerArtistId, profile.id), eq(blocks.blockedArtistId, data.toArtistId)),
        and(eq(blocks.blockerArtistId, data.toArtistId), eq(blocks.blockedArtistId, profile.id)),
      ),
    )
    .limit(1);
  if (blocked.length) throw new Error("New interactions with this artist are blocked.");

  const terms: Terms = { ...data.terms } as Terms;
  if (terms.mode === "Trade") terms.price = 0;

  await db.transaction(async (tx) => {
    if (data.verseId) {
      // Serialise on the announcement so two simultaneous selections cannot both
      // pass the "no pending proposal" check.
      await lockRow(tx, "open_verses", data.verseId);

      const [verse] = await tx
        .select()
        .from(openVerses)
        .where(eq(openVerses.id, data.verseId))
        .limit(1);
      if (!verse || verse.status !== "Published" || verse.ownerId !== profile.id) {
        throw new Error("Open verse is unavailable.");
      }
      if (verse.mode !== terms.mode) {
        throw new Error("Collaboration type must match the announcement.");
      }
      const pending = await tx
        .select()
        .from(proposals)
        .where(
          and(
            eq(proposals.verseId, data.verseId),
            eq(proposals.status, "Sent"),
            sql`${proposals.expiresAt} > now()`,
          ),
        )
        .limit(1);
      if (pending.length) throw new Error("A final proposal is already pending.");
      if (!data.applicationId) throw new Error("Choose an eligible application.");

      const [app] = await tx
        .select()
        .from(applications)
        .where(eq(applications.id, data.applicationId))
        .limit(1);
      if (
        !app ||
        app.verseId !== data.verseId ||
        app.artistId !== data.toArtistId ||
        !["Submitted", "Shortlisted"].includes(app.status)
      ) {
        throw new Error("Choose an eligible application for this announcement.");
      }
      await tx.update(applications).set({ status: "Selected" }).where(eq(applications.id, app.id));
    }

    await tx.insert(proposals).values({
      fromArtistId: profile.id,
      toArtistId: data.toArtistId,
      payerArtistId: profile.id,
      performerArtistId: data.toArtistId,
      verseId: data.verseId,
      applicationId: data.applicationId,
      terms,
      status: "Sent",
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
  });
  revalidateApp();
}

export async function transitionProposalAction(proposalId: string, action: unknown) {
  const next = parseOrThrow(proposalActionSchema, action);
  const { profile } = await requireOnboardedArtist();
  const db = getDb();

  // Persist expiry first, in its own transaction, so a lapsed proposal releases
  // its candidate even though the call below rejects.
  await expireStaleProposals();

  await db.transaction(async (tx) => {
    // Lock the proposal itself before any read-modify-write so accept and
    // withdraw cannot both observe Sent and both succeed.
    await lockRow(tx, "proposals", proposalId);

    const [p] = await tx.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!p) throw new Error("Proposal not found.");
    if (p.status === "Expired" || p.expiresAt.getTime() <= Date.now()) {
      throw new Error("This proposal has expired.");
    }
    if (p.status !== "Sent") throw new Error("This proposal is no longer pending.");

    if (next === "Withdrawn") {
      if (p.fromArtistId !== profile.id) throw new Error("Only the sender can withdraw.");
      const withdrawn = await tx
        .update(proposals)
        .set({ status: "Withdrawn" })
        .where(and(eq(proposals.id, proposalId), eq(proposals.status, "Sent")))
        .returning({ id: proposals.id });
      if (!withdrawn.length) throw new Error("This proposal is no longer pending.");
      if (p.applicationId) {
        await tx
          .update(applications)
          .set({ status: "Submitted" })
          .where(eq(applications.id, p.applicationId));
      }
      return;
    }

    if (p.toArtistId !== profile.id) throw new Error("Only the recipient can do this.");

    if (next === "Declined") {
      const declined = await tx
        .update(proposals)
        .set({ status: "Declined" })
        .where(and(eq(proposals.id, proposalId), eq(proposals.status, "Sent")))
        .returning({ id: proposals.id });
      if (!declined.length) throw new Error("This proposal is no longer pending.");
      if (p.applicationId) {
        await tx
          .update(applications)
          .set({ status: "Submitted" })
          .where(eq(applications.id, p.applicationId));
      }
      return;
    }

    // --- Accept ---
    if (p.verseId) {
      // Lock the announcement before the single-collaborator check so two
      // concurrent acceptances cannot both observe "no collaborator yet".
      await lockRow(tx, "open_verses", p.verseId);
    }

    if (p.applicationId) {
      const [app] = await tx
        .select()
        .from(applications)
        .where(eq(applications.id, p.applicationId))
        .limit(1);
      if (!app || app.status !== "Selected" || app.artistId !== p.toArtistId) {
        throw new Error("This candidate is no longer reserved.");
      }
    }

    const existing = await tx
      .select()
      .from(collaborations)
      .where(eq(collaborations.proposalId, proposalId))
      .limit(1);
    if (existing.length) throw new Error("Already accepted.");

    const terms = p.terms as Terms;
    if (p.verseId) {
      const [verse] = await tx
        .select()
        .from(openVerses)
        .where(eq(openVerses.id, p.verseId))
        .limit(1);
      if (!verse || verse.status !== "Published") throw new Error("Open verse unavailable.");
      const collabForVerse = await tx
        .select({ id: collaborations.id })
        .from(collaborations)
        .innerJoin(proposals, eq(collaborations.proposalId, proposals.id))
        .where(eq(proposals.verseId, p.verseId))
        .limit(1);
      if (collabForVerse.length) throw new Error("This open verse already has a collaborator.");
      await tx.update(openVerses).set({ status: "Closed" }).where(eq(openVerses.id, p.verseId));
      await tx
        .update(applications)
        .set({ status: "Rejected" })
        .where(
          and(
            eq(applications.verseId, p.verseId),
            ne(applications.id, p.applicationId ?? "00000000-0000-0000-0000-000000000000"),
          ),
        );
      if (p.applicationId) {
        await tx
          .update(applications)
          .set({ status: "Selected" })
          .where(eq(applications.id, p.applicationId));
      }
    }

    const status = terms.mode === "Paid" ? ("Awaiting payment" as const) : ("Active" as const);

    // Flip Sent → Accepted before inserting the collab so a concurrent withdraw
    // blocked on the proposal lock sees Accepted and aborts.
    const accepted = await tx
      .update(proposals)
      .set({ status: "Accepted" })
      .where(and(eq(proposals.id, proposalId), eq(proposals.status, "Sent")))
      .returning({ id: proposals.id });
    if (!accepted.length) throw new Error("This proposal is no longer pending.");

    const [collab] = await tx
      .insert(collaborations)
      .values({
        proposalId: p.id,
        payerArtistId: p.payerArtistId,
        agreement: terms,
        status,
        // Frozen at acceptance so later offer edits cannot change what is owed.
        amountCents: terms.mode === "Paid" ? terms.price : 0,
      })
      .returning();

    await tx.insert(collaborationParticipants).values([
      { collaborationId: collab.id, artistId: p.fromArtistId },
      { collaborationId: collab.id, artistId: p.toArtistId },
    ]);

    const contribs = [
      {
        collaborationId: collab.id,
        performerArtistId: p.performerArtistId,
        recipientArtistId: p.payerArtistId,
        obligation: terms.theirContribution,
        status: "Pending" as const,
        deadlineAt:
          terms.mode === "Trade"
            ? new Date(terms.theirTradeDate || terms.tradeDate || Date.now())
            : null,
      },
    ];
    if (terms.mode === "Trade") {
      contribs.push({
        collaborationId: collab.id,
        performerArtistId: p.payerArtistId,
        recipientArtistId: p.performerArtistId,
        obligation: terms.yourContribution,
        status: "Pending" as const,
        deadlineAt: new Date(terms.tradeDate || Date.now()),
      });
    }
    await tx.insert(contributions).values(contribs);
  });

  revalidateApp();
}

/**
 * Opens Stripe Checkout for a paid collaboration.
 *
 * Returns a redirect URL only. The collaboration is flipped to Active by the
 * webhook, never here, so closing the tab after paying still activates the work.
 */
export async function activatePaymentAction(collaborationId: string) {
  assertPaymentsReady({
    paymentsEnabled: paymentsEnabled(),
    stripeConfigured: stripeConfigured(),
  });
  const { profile } = await requireOnboardedArtist();
  return createCheckoutSession(collaborationId, profile.id);
}

/** Starts or resumes Stripe Connect onboarding for the signed-in artist. */
export async function startPayoutOnboarding() {
  if (!stripeConfigured()) throw new Error("Payment provider is not configured.");
  const { profile, session } = await requireOnboardedArtist();
  const { url } = await ensureConnectAccount(profile.id, session.user.email ?? null);
  revalidateApp();
  return { url };
}

/** Refreshes the cached Connect capability after the artist returns from Stripe. */
export async function refreshPayoutStatus() {
  if (!stripeConfigured()) return { payoutsEnabled: false };
  const { profile } = await requireOnboardedArtist();
  const result = await syncConnectStatus(profile.id);
  revalidateApp();
  return result;
}

export async function contributionActionServer(input: unknown) {
  const data = parseOrThrow(contributionSchema, input);
  const { profile, session } = await requireOnboardedArtist();
  const db = getDb();

  // Deliveries upload straight to Blob, so verify each file against authoritative
  // metadata before we open the transaction. Ownership is the Blob pathname —
  // never a parallel client field that could claim someone else's object.
  const verified: { pathname: string; url: string; name: string; mime: string; size: number }[] = [];
  if (data.action === "deliver") {
    const uploads = data.uploads ?? [];
    if (!uploads.length) throw new Error("Attach at least one audio or ZIP file.");
    for (const u of uploads) {
      const meta = await head(u.url);
      assertOwnedBlobPath(meta, { userId: session.user.id, kind: "delivery" });
      assertDeliveryFile(u.name, meta.contentType ?? "", meta.size);
      verified.push({
        pathname: meta.pathname,
        url: meta.url ?? u.url,
        name: u.name,
        mime: meta.contentType ?? "application/octet-stream",
        size: meta.size,
      });
    }
  }

  let completed = false;
  await db.transaction(async (tx) => {
    // Serialise everything touching this collaboration. Without it, two
    // approvals landing together each read the other contribution as not-yet
    // approved and neither flips the collaboration to Completed.
    await lockRow(tx, "collaborations", data.collaborationId);

    const [c] = await tx
      .select()
      .from(collaborations)
      .where(eq(collaborations.id, data.collaborationId))
      .limit(1);
    if (!c || c.status !== "Active") throw new Error("This collaboration is not active.");
    const parts = await tx
      .select()
      .from(collaborationParticipants)
      .where(eq(collaborationParticipants.collaborationId, c.id));
    if (!parts.some((p) => p.artistId === profile.id)) throw new Error("Access denied.");

    const [t] = await tx
      .select()
      .from(contributions)
      .where(
        and(eq(contributions.id, data.contributionId), eq(contributions.collaborationId, c.id)),
      )
      .limit(1);
    if (!t) throw new Error("Contribution not found.");

    if (data.action === "deliver") {
      if (t.performerArtistId !== profile.id) {
        throw new Error("You cannot upload to this contribution.");
      }
      if (!["Pending", "Revision requested"].includes(t.status)) {
        throw new Error("You cannot upload to this contribution.");
      }
      const version =
        (
          await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(deliveries)
            .where(eq(deliveries.contributionId, t.id))
        )[0]?.n ?? 0;
      const [delivery] = await tx
        .insert(deliveries)
        .values({
          contributionId: t.id,
          version: version + 1,
          authorArtistId: profile.id,
          notes: data.notes ?? "",
        })
        .returning();
      for (const file of verified) {
        const [asset] = await tx
          .insert(assets)
          .values({
            ownerUserId: session.user.id,
            blobUrl: file.url,
            pathname: file.pathname,
            mime: file.mime,
            size: file.size,
            visibility: "private",
          })
          .returning();
        await tx.insert(deliveryFiles).values({
          deliveryId: delivery.id,
          assetId: asset.id,
          name: file.name,
        });
      }
      await tx.update(contributions).set({ status: "Delivered" }).where(eq(contributions.id, t.id));
      return;
    }

    if (t.recipientArtistId !== profile.id || t.status !== "Delivered") {
      throw new Error("Only the recipient can review a delivery.");
    }
    const agreement = c.agreement as Terms;

    if (data.action === "revise") {
      if (t.revisionsUsed >= agreement.revisions) throw new Error("No included revisions remain.");
      await tx
        .update(contributions)
        .set({ status: "Revision requested", revisionsUsed: t.revisionsUsed + 1 })
        .where(eq(contributions.id, t.id));
      if (data.notes?.trim()) {
        await tx.insert(messages).values({
          proposalId: c.proposalId,
          authorArtistId: profile.id,
          text: `Revision requested: ${data.notes.trim()}`,
        });
      }
      return;
    }

    await tx.update(contributions).set({ status: "Approved" }).where(eq(contributions.id, t.id));
    // Re-read under the row lock: this now sees any sibling approval committed
    // by a concurrent request rather than a stale snapshot.
    const all = await tx
      .select()
      .from(contributions)
      .where(eq(contributions.collaborationId, c.id));
    if (all.every((row) => row.status === "Approved")) {
      await tx
        .update(collaborations)
        .set({ status: "Completed" })
        .where(eq(collaborations.id, c.id));
      completed = true;
    }
  });

  // Escrow is released after the transaction commits: a Stripe outage must not
  // roll back an approval the recipient already made. The outbox survives that
  // outage so a reconcile pass can finish the transfer later.
  if (completed && stripeConfigured()) {
    await enqueueRelease(data.collaborationId);
    try {
      await releaseEscrow(data.collaborationId);
    } catch (error) {
      await captureException(error, {
        tags: { area: "release_deferred", collaborationId: data.collaborationId },
      });
    }
  }

  revalidateApp();
}

export async function cancelCollaborationAction(collaborationId: string) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();

  let cancelled = false;
  let wasAwaitingPayment = false;
  let needsRefund = false;
  await db.transaction(async (tx) => {
    await lockRow(tx, "collaborations", collaborationId);
    const [c] = await tx
      .select()
      .from(collaborations)
      .where(eq(collaborations.id, collaborationId))
      .limit(1);
    if (!c) throw new Error("Not found.");
    const parts = await tx
      .select()
      .from(collaborationParticipants)
      .where(eq(collaborationParticipants.collaborationId, c.id));
    if (!parts.some((p) => p.artistId === profile.id)) throw new Error("Access denied.");

    // Money already released to the performer cannot be unwound here.
    if (c.stripeTransferId || c.settlementStatus === "released") {
      throw new Error("This work was already paid out.");
    }

    if (c.status === "Awaiting payment") {
      if (c.payerArtistId !== profile.id) {
        throw new Error("Only the payer can cancel before activation.");
      }
      wasAwaitingPayment = true;
      await tx.update(collaborations).set({ status: "Cancelled" }).where(eq(collaborations.id, c.id));
      cancelled = true;
      // Late webhook may still arrive; if money was already recorded, refund.
      if (c.paidAt && !c.refundedAt) needsRefund = true;
    } else if (c.status === "Active") {
      if (c.cancelByArtistId && c.cancelByArtistId !== profile.id) {
        await tx
          .update(collaborations)
          .set({ status: "Cancelled" })
          .where(eq(collaborations.id, c.id));
        cancelled = true;
        if (c.paidAt && !c.refundedAt) needsRefund = true;
      } else {
        await tx
          .update(collaborations)
          .set({ cancelByArtistId: profile.id })
          .where(eq(collaborations.id, c.id));
      }
    } else {
      throw new Error("This work cannot be cancelled.");
    }
  });

  if (wasAwaitingPayment && stripeConfigured()) {
    try {
      await expireOpenCheckout(collaborationId);
    } catch (error) {
      console.error("Checkout expire failed", collaborationId, error);
    }
  }

  // Refund escrow once the cancellation is agreed and committed. Failures leave
  // refund_pending for the reconcile outbox.
  if (cancelled && needsRefund && stripeConfigured()) {
    await enqueueRefund(collaborationId);
    try {
      await refundCollaboration(collaborationId);
    } catch (error) {
      await captureException(error, {
        tags: { area: "refund_deferred", collaborationId },
      });
    }
  }

  revalidateApp();
}

export async function sendMessageAction(proposalId: string, text: string) {
  const { profile } = await requireOnboardedArtist();
  await assertRateLimit("message", `artist:${profile.id}`);
  const body = text.trim();
  if (!body) return;
  const db = getDb();
  const [p] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!p || ![p.fromArtistId, p.toArtistId].includes(profile.id)) {
    throw new Error("Access denied.");
  }
  await db.insert(messages).values({
    proposalId,
    authorArtistId: profile.id,
    text: body.slice(0, 4000),
  });
  revalidateApp();
}

export async function toggleBlockAction(targetArtistId: string) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const existing = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.blockerArtistId, profile.id), eq(blocks.blockedArtistId, targetArtistId)))
    .limit(1);
  if (existing.length) {
    await db
      .delete(blocks)
      .where(
        and(eq(blocks.blockerArtistId, profile.id), eq(blocks.blockedArtistId, targetArtistId)),
      );
  } else {
    await db.insert(blocks).values({
      blockerArtistId: profile.id,
      blockedArtistId: targetArtistId,
    });
  }
  revalidateApp();
}

export async function reportAction(target: string, reason: string) {
  const { profile } = await requireOnboardedArtist();
  await assertRateLimit("report", `artist:${profile.id}`);
  const db = getDb();
  await db.insert(reports).values({
    authorArtistId: profile.id,
    target,
    reason: reason.trim().slice(0, 4000),
  });
  revalidateApp();
}

export async function leaveReviewAction(input: unknown) {
  const data = parseOrThrow(reviewSchema, input);
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, data.collaborationId))
    .limit(1);
  if (!c || c.status !== "Completed") throw new Error("This review is not available.");
  const parts = await db
    .select()
    .from(collaborationParticipants)
    .where(eq(collaborationParticipants.collaborationId, c.id));
  if (!parts.some((p) => p.artistId === profile.id)) throw new Error("Access denied.");
  const subject = parts.find((p) => p.artistId !== profile.id);
  if (!subject) throw new Error("This review is not available.");
  await db.insert(reviews).values({
    collaborationId: c.id,
    authorArtistId: profile.id,
    subjectArtistId: subject.artistId,
    rating: data.rating,
    text: data.text,
  });
  revalidateApp();
}

export async function updateApplicationStatus(applicationId: string, status: unknown) {
  const next = parseOrThrow(applicationStatusSchema, status);
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!app) throw new Error("Application not found.");
  const [verse] = await db.select().from(openVerses).where(eq(openVerses.id, app.verseId)).limit(1);
  if (next === "Withdrawn") {
    if (app.artistId !== profile.id) throw new Error("Access denied.");
  } else if (!verse || verse.ownerId !== profile.id) {
    throw new Error("Access denied.");
  }
  await db.update(applications).set({ status: next }).where(eq(applications.id, applicationId));
  if (next === "Withdrawn") {
    await db
      .update(proposals)
      .set({ status: "Declined" })
      .where(and(eq(proposals.applicationId, applicationId), eq(proposals.status, "Sent")));
  }
  revalidateApp();
}

export async function shortlistOrReject(applicationId: string, status: unknown) {
  return updateApplicationStatus(applicationId, status);
}
