"use server";

import { and, eq, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  applications,
  artistProfiles,
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
  audioSamples,
} from "@/db/schema";
import type { Terms } from "@/domain/model";
import { paymentsEnabled } from "@/lib/flags";
import { uploadDeliveryFile, uploadPublicDemo } from "@/server/blob";
import { requireArtist, requireOnboardedArtist } from "@/server/session";
import { loadCatalogStore } from "@/server/catalog";

function revalidateApp() {
  revalidatePath("/", "layout");
}

export async function getProdBootstrap() {
  const { auth } = await import("@/auth");
  const session = await auth();
  const artistId = session?.user?.artistId;
  const store = await loadCatalogStore(artistId);
  return {
    store,
    account: artistId ?? null,
    onboardingComplete: session?.user?.onboardingComplete ?? false,
    userEmail: session?.user?.email ?? null,
    paymentsEnabled: paymentsEnabled(),
  };
}

export async function completeOnboarding(input: {
  name: string;
  slug: string;
  bio?: string;
  genre: string;
  language: string;
  trade: boolean;
}) {
  const { profile } = await requireArtist();
  const slug = input.slug.toLowerCase().trim();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Use lowercase letters, numbers and hyphens for your slug.");
  }
  const db = getDb();
  const clash = await db
    .select({ id: artistProfiles.id })
    .from(artistProfiles)
    .where(and(eq(artistProfiles.slug, slug), ne(artistProfiles.id, profile.id)))
    .limit(1);
  if (clash.length) throw new Error("That slug is already in use.");
  await db
    .update(artistProfiles)
    .set({
      name: input.name.trim(),
      slug,
      bio: input.bio?.trim() ?? "",
      genre: input.genre,
      language: input.language,
      trade: input.trade,
      onboardingComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(artistProfiles.id, profile.id));
  revalidateApp();
  return { ok: true };
}

export async function updateProfile(input: {
  name: string;
  slug: string;
  bio?: string;
  genre: string;
  language: string;
  trade: boolean;
}) {
  return completeOnboarding(input);
}

export async function attachProfileDemo(formData: FormData) {
  const { session, profile } = await requireOnboardedArtist();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a demo file.");
  const asset = await uploadPublicDemo(session.user.id, file);
  const db = getDb();
  await db.insert(audioSamples).values({
    profileId: profile.id,
    title: file.name,
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

export async function saveOffer(input: {
  id?: string;
  title: string;
  mode: "Paid" | "Trade";
  price: number;
  days: number;
  revisions: number;
  files: string;
}) {
  const { profile } = await requireOnboardedArtist();
  if (!profile.hasDemo) throw new Error("Add a profile demo before publishing an offer.");
  const db = getDb();
  if (input.id) {
    await db
      .update(featureOffers)
      .set({
        title: input.title,
        mode: input.mode,
        priceCents: input.mode === "Trade" ? 0 : Math.round(input.price * 100),
        days: input.days,
        revisions: input.revisions,
        files: input.files,
      })
      .where(and(eq(featureOffers.id, input.id), eq(featureOffers.artistId, profile.id)));
  } else {
    await db.insert(featureOffers).values({
      artistId: profile.id,
      title: input.title,
      mode: input.mode,
      priceCents: input.mode === "Trade" ? 0 : Math.round(input.price * 100),
      days: input.days,
      revisions: input.revisions,
      files: input.files,
    });
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

export async function saveOpenVerse(input: {
  id?: string;
  title: string;
  brief: string;
  genre: string;
  language: string;
  mode: "Paid" | "Trade";
  price: number;
  bpm: number;
  key: string;
  status: "Draft" | "Published" | "Closed";
}) {
  const { profile } = await requireOnboardedArtist();
  if (input.status === "Published" && !profile.hasDemo) {
    throw new Error("Add a profile demo before publishing.");
  }
  const db = getDb();
  if (input.id) {
    const [existing] = await db
      .select()
      .from(openVerses)
      .where(and(eq(openVerses.id, input.id), eq(openVerses.ownerId, profile.id)))
      .limit(1);
    if (!existing) throw new Error("Access denied.");
    if (existing.status === "Closed") throw new Error("This announcement is closed.");
    await db
      .update(openVerses)
      .set({
        title: input.title,
        brief: input.brief,
        genre: input.genre,
        language: input.language,
        mode: input.mode,
        budgetCents: input.mode === "Paid" ? Math.round(input.price * 100) : 0,
        bpm: input.bpm,
        key: input.key,
        status: input.status === "Closed" ? "Closed" : input.status,
      })
      .where(eq(openVerses.id, input.id));
  } else {
    await db.insert(openVerses).values({
      ownerId: profile.id,
      title: input.title,
      brief: input.brief,
      genre: input.genre,
      language: input.language,
      mode: input.mode,
      budgetCents: input.mode === "Paid" ? Math.round(input.price * 100) : 0,
      bpm: input.bpm,
      key: input.key,
      artIndex: profile.artIndex,
      status: input.status,
    });
  }
  revalidateApp();
}

export async function applyToVerse(input: {
  verseId: string;
  message: string;
  price?: number;
}) {
  const { profile } = await requireOnboardedArtist();
  if (!profile.hasDemo) throw new Error("Add a demo to your profile first.");
  const db = getDb();
  const [verse] = await db.select().from(openVerses).where(eq(openVerses.id, input.verseId)).limit(1);
  if (!verse || verse.status !== "Published") throw new Error("This announcement is not open.");
  if (verse.ownerId === profile.id) throw new Error("You cannot apply to your own announcement.");
  const blocked = await db
    .select()
    .from(blocks)
    .where(
      and(eq(blocks.blockerArtistId, verse.ownerId), eq(blocks.blockedArtistId, profile.id)),
    )
    .limit(1);
  if (blocked.length) throw new Error("This artist is blocked.");
  const existing = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.verseId, input.verseId),
        eq(applications.artistId, profile.id),
        ne(applications.status, "Withdrawn"),
      ),
    )
    .limit(1);
  if (existing.length) throw new Error("You already have an active application.");
  await db.insert(applications).values({
    verseId: input.verseId,
    artistId: profile.id,
    message: input.message.trim(),
    priceCents: Math.round((input.price ?? verse.budgetCents / 100) * 100),
    status: "Submitted",
  });
  revalidateApp();
}

export async function sendProposalAction(input: {
  toArtistId: string;
  terms: Terms;
  verseId?: string;
  applicationId?: string;
  offerId?: string;
}) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  if (profile.id === input.toArtistId) throw new Error("You cannot propose to yourself.");
  if (input.offerId) {
    const [offer] = await db
      .select()
      .from(featureOffers)
      .where(and(eq(featureOffers.id, input.offerId), eq(featureOffers.archived, false)))
      .limit(1);
    if (!offer) throw new Error("This offer is no longer available.");
  }
  const blocked = await db
    .select()
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerArtistId, profile.id), eq(blocks.blockedArtistId, input.toArtistId)),
        and(eq(blocks.blockerArtistId, input.toArtistId), eq(blocks.blockedArtistId, profile.id)),
      ),
    )
    .limit(1);
  if (blocked.length) throw new Error("New interactions with this artist are blocked.");

  const terms = { ...input.terms };
  if (terms.mode === "Trade") {
    terms.price = 0;
    if (!terms.tradeDate || Date.parse(terms.tradeDate) <= Date.now()) {
      throw new Error("Choose a future trade deadline.");
    }
  }
  if (terms.revisions < 0 || terms.revisions > 10) throw new Error("Invalid revision allowance.");
  if (terms.days < 1 || terms.days > 90) throw new Error("Choose 1–90 days.");
  if (!terms.brief.trim() || !terms.theirContribution.trim()) {
    throw new Error("Add a brief and contribution.");
  }
  if (terms.mode === "Trade" && !terms.yourContribution.trim()) {
    throw new Error("Describe both contributions.");
  }

  await db.transaction(async (tx) => {
    if (input.verseId) {
      const [verse] = await tx
        .select()
        .from(openVerses)
        .where(eq(openVerses.id, input.verseId))
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
            eq(proposals.verseId, input.verseId),
            eq(proposals.status, "Sent"),
            sql`${proposals.expiresAt} > now()`,
          ),
        )
        .limit(1);
      if (pending.length) throw new Error("A final proposal is already pending.");
      if (!input.applicationId) throw new Error("Choose an eligible application.");
      const [app] = await tx
        .select()
        .from(applications)
        .where(eq(applications.id, input.applicationId))
        .limit(1);
      if (
        !app ||
        app.verseId !== input.verseId ||
        app.artistId !== input.toArtistId ||
        !["Submitted", "Shortlisted"].includes(app.status)
      ) {
        throw new Error("Choose an eligible application for this announcement.");
      }
      await tx
        .update(applications)
        .set({ status: "Selected" })
        .where(eq(applications.id, app.id));
    }

    await tx.insert(proposals).values({
      fromArtistId: profile.id,
      toArtistId: input.toArtistId,
      payerArtistId: profile.id,
      performerArtistId: input.toArtistId,
      verseId: input.verseId,
      applicationId: input.applicationId,
      terms,
      status: "Sent",
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
  });
  revalidateApp();
}

export async function transitionProposalAction(
  proposalId: string,
  action: "Accepted" | "Declined" | "Withdrawn",
) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();

  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!p) throw new Error("Proposal not found.");
    if (p.status !== "Sent") throw new Error("This proposal is no longer pending.");
    if (p.expiresAt.getTime() <= Date.now()) {
      await tx.update(proposals).set({ status: "Expired" }).where(eq(proposals.id, proposalId));
      throw new Error("This proposal has expired.");
    }
    if (action === "Withdrawn") {
      if (p.fromArtistId !== profile.id) throw new Error("Only the sender can withdraw.");
      await tx.update(proposals).set({ status: "Withdrawn" }).where(eq(proposals.id, proposalId));
      if (p.applicationId) {
        await tx
          .update(applications)
          .set({ status: "Submitted" })
          .where(eq(applications.id, p.applicationId));
      }
      return;
    }
    if (p.toArtistId !== profile.id) throw new Error("Only the recipient can do this.");
    if (action === "Declined") {
      await tx.update(proposals).set({ status: "Declined" }).where(eq(proposals.id, proposalId));
      if (p.applicationId) {
        await tx
          .update(applications)
          .set({ status: "Submitted" })
          .where(eq(applications.id, p.applicationId));
      }
      return;
    }

    // Accept
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
      const [verse] = await tx.select().from(openVerses).where(eq(openVerses.id, p.verseId)).limit(1);
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

    const status =
      terms.mode === "Paid"
        ? ("Awaiting payment" as const)
        : ("Active" as const);

    const [collab] = await tx
      .insert(collaborations)
      .values({
        proposalId: p.id,
        payerArtistId: p.payerArtistId,
        agreement: terms,
        status,
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
    await tx.update(proposals).set({ status: "Accepted" }).where(eq(proposals.id, proposalId));
  });

  revalidateApp();
}

export async function activatePaymentAction(_collaborationId: string) {
  if (!paymentsEnabled()) {
    throw new Error("Payments are not available yet. Trades work without payment.");
  }
  throw new Error("Payment provider is not configured.");
}

export async function contributionActionServer(input: {
  collaborationId: string;
  contributionId: string;
  action: "deliver" | "approve" | "revise";
  notes?: string;
  formData?: FormData;
}) {
  const { profile, session } = await requireOnboardedArtist();
  const db = getDb();

  await db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(collaborations)
      .where(eq(collaborations.id, input.collaborationId))
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
        and(
          eq(contributions.id, input.contributionId),
          eq(contributions.collaborationId, c.id),
        ),
      )
      .limit(1);
    if (!t) throw new Error("Contribution not found.");

    if (input.action === "deliver") {
      if (t.performerArtistId !== profile.id) throw new Error("You cannot upload to this contribution.");
      if (!["Pending", "Revision requested"].includes(t.status)) {
        throw new Error("You cannot upload to this contribution.");
      }
      const files = input.formData
        ? [...input.formData.getAll("files")].filter((x): x is File => x instanceof File && x.size > 0)
        : [];
      if (!files.length) throw new Error("Attach at least one audio or ZIP file.");
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
          notes: input.notes?.trim() || "",
        })
        .returning();
      for (const file of files) {
        const asset = await uploadDeliveryFile(session.user.id, file);
        await tx.insert(deliveryFiles).values({
          deliveryId: delivery.id,
          assetId: asset.id,
          name: file.name,
        });
      }
      await tx
        .update(contributions)
        .set({ status: "Delivered" })
        .where(eq(contributions.id, t.id));
      return;
    }

    if (t.recipientArtistId !== profile.id || t.status !== "Delivered") {
      throw new Error("Only the recipient can review a delivery.");
    }
    const agreement = c.agreement as Terms;
    if (input.action === "revise") {
      if (t.revisionsUsed >= agreement.revisions) throw new Error("No included revisions remain.");
      await tx
        .update(contributions)
        .set({
          status: "Revision requested",
          revisionsUsed: t.revisionsUsed + 1,
        })
        .where(eq(contributions.id, t.id));
      if (input.notes?.trim()) {
        await tx.insert(messages).values({
          proposalId: c.proposalId,
          authorArtistId: profile.id,
          text: `Revision requested: ${input.notes.trim()}`,
        });
      }
      return;
    }

    await tx.update(contributions).set({ status: "Approved" }).where(eq(contributions.id, t.id));
    const all = await tx
      .select()
      .from(contributions)
      .where(eq(contributions.collaborationId, c.id));
    const approved = all.map((row) =>
      row.id === t.id ? { ...row, status: "Approved" as const } : row,
    );
    if (approved.every((row) => row.status === "Approved")) {
      await tx
        .update(collaborations)
        .set({ status: "Completed" })
        .where(eq(collaborations.id, c.id));
    }
  });

  revalidateApp();
}

export async function cancelCollaborationAction(collaborationId: string) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  if (!c) throw new Error("Not found.");
  const parts = await db
    .select()
    .from(collaborationParticipants)
    .where(eq(collaborationParticipants.collaborationId, c.id));
  if (!parts.some((p) => p.artistId === profile.id)) throw new Error("Access denied.");
  if (c.status === "Awaiting payment") {
    if (c.payerArtistId !== profile.id) throw new Error("Only the payer can cancel before activation.");
    await db.update(collaborations).set({ status: "Cancelled" }).where(eq(collaborations.id, c.id));
  } else if (c.status === "Active") {
    if (c.cancelByArtistId && c.cancelByArtistId !== profile.id) {
      await db.update(collaborations).set({ status: "Cancelled" }).where(eq(collaborations.id, c.id));
    } else {
      await db
        .update(collaborations)
        .set({ cancelByArtistId: profile.id })
        .where(eq(collaborations.id, c.id));
    }
  } else {
    throw new Error("This work cannot be cancelled.");
  }
  revalidateApp();
}

export async function sendMessageAction(proposalId: string, text: string) {
  const { profile } = await requireOnboardedArtist();
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
    .where(
      and(eq(blocks.blockerArtistId, profile.id), eq(blocks.blockedArtistId, targetArtistId)),
    )
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
  const db = getDb();
  await db.insert(reports).values({
    authorArtistId: profile.id,
    target,
    reason: reason.trim(),
  });
  revalidateApp();
}

export async function leaveReviewAction(input: {
  collaborationId: string;
  rating: number;
  text: string;
}) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, input.collaborationId))
    .limit(1);
  if (!c || c.status !== "Completed") throw new Error("This review is not available.");
  const parts = await db
    .select()
    .from(collaborationParticipants)
    .where(eq(collaborationParticipants.collaborationId, c.id));
  if (!parts.some((p) => p.artistId === profile.id)) throw new Error("Access denied.");
  await db.insert(reviews).values({
    collaborationId: c.id,
    authorArtistId: profile.id,
    rating: input.rating,
    text: input.text.trim(),
  });
  revalidateApp();
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "Shortlisted" | "Rejected" | "Withdrawn",
) {
  const { profile } = await requireOnboardedArtist();
  const db = getDb();
  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!app) throw new Error("Application not found.");
  const [verse] = await db.select().from(openVerses).where(eq(openVerses.id, app.verseId)).limit(1);
  if (status === "Withdrawn") {
    if (app.artistId !== profile.id) throw new Error("Access denied.");
  } else if (!verse || verse.ownerId !== profile.id) {
    throw new Error("Access denied.");
  }
  await db.update(applications).set({ status }).where(eq(applications.id, applicationId));
  if (status === "Withdrawn") {
    await db
      .update(proposals)
      .set({ status: "Declined" })
      .where(
        and(eq(proposals.applicationId, applicationId), eq(proposals.status, "Sent")),
      );
  }
  revalidateApp();
}

export async function shortlistOrReject(
  applicationId: string,
  status: "Shortlisted" | "Rejected",
) {
  return updateApplicationStatus(applicationId, status);
}
