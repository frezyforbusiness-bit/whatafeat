// Server-only payment helpers. Imported by Server Actions and the Stripe
// webhook; never reachable directly from the browser.
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  artistProfiles,
  collaborationParticipants,
  collaborations,
  contributions,
} from "@/db/schema";
import type { Terms } from "@/domain/model";
import { appUrl, getStripe, platformFeeCents } from "@/server/stripe";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Creates (or reuses) the performer's Connect Express account and returns an
 * onboarding link. Artists must finish this before they can be paid.
 */
export async function ensureConnectAccount(profileId: string, email: string | null) {
  const db = getDb();
  const stripe = getStripe();
  const [profile] = await db
    .select()
    .from(artistProfiles)
    .where(eq(artistProfiles.id, profileId))
    .limit(1);
  if (!profile) throw new Error("Artist profile missing.");

  let accountId = profile.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: email ?? undefined,
      business_type: "individual",
      capabilities: { transfers: { requested: true } },
      metadata: { artistProfileId: profile.id },
    });
    accountId = account.id;
    await db
      .update(artistProfiles)
      .set({ stripeAccountId: accountId, updatedAt: new Date() })
      .where(eq(artistProfiles.id, profile.id));
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/settings?connect=refresh`,
    return_url: `${appUrl()}/settings?connect=done`,
    type: "account_onboarding",
  });
  return { url: link.url, accountId };
}

/** Re-reads Connect status from Stripe and caches the payout capability. */
export async function syncConnectStatus(profileId: string) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(artistProfiles)
    .where(eq(artistProfiles.id, profileId))
    .limit(1);
  if (!profile?.stripeAccountId) return { payoutsEnabled: false };

  const account = await getStripe().accounts.retrieve(profile.stripeAccountId);
  const enabled = Boolean(account.charges_enabled && account.payouts_enabled);
  await db
    .update(artistProfiles)
    .set({ stripePayoutsEnabled: enabled, updatedAt: new Date() })
    .where(eq(artistProfiles.id, profile.id));
  return { payoutsEnabled: enabled };
}

/**
 * Starts escrow for a paid collaboration.
 *
 * The charge lands on the platform account — no `transfer_data` — so the money
 * is held until the delivery is approved. Only the returned URL goes back to the
 * browser; the collaboration stays "Awaiting payment" until the webhook fires.
 */
export async function createCheckoutSession(collaborationId: string, payerProfileId: string) {
  const db = getDb();
  const stripe = getStripe();

  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  if (!c) throw new Error("Collaboration not found.");
  if (c.payerArtistId !== payerProfileId) throw new Error("Only the payer can pay.");
  if (c.status !== "Awaiting payment") throw new Error("This collaboration is not awaiting payment.");
  if (c.paidAt) throw new Error("This collaboration is already paid.");

  const agreement = c.agreement as Terms;
  const amount = c.amountCents || agreement.price;
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid amount.");

  const performer = await performerFor(c.id, c.payerArtistId);
  if (!performer.stripeAccountId || !performer.stripePayoutsEnabled) {
    throw new Error(`${performer.name} has not finished payout setup yet.`);
  }

  const transferGroup = c.stripeTransferGroup ?? `collab_${c.id}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: c.id,
      success_url: `${appUrl()}/collaborations/${c.id}?paid=1`,
      cancel_url: `${appUrl()}/collaborations/${c.id}?paid=0`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amount,
            product_data: { name: agreement.title || "Feature collaboration" },
          },
        },
      ],
      payment_intent_data: {
        transfer_group: transferGroup,
        metadata: { collaborationId: c.id },
      },
      metadata: { collaborationId: c.id },
    },
    // Retrying the button must not open a second charge for the same attempt.
    { idempotencyKey: `checkout_${c.id}_${amount}` },
  );

  await db
    .update(collaborations)
    .set({
      amountCents: amount,
      platformFeeCents: platformFeeCents(amount),
      stripeCheckoutSessionId: session.id,
      stripeTransferGroup: transferGroup,
    })
    .where(eq(collaborations.id, c.id));

  return { url: session.url };
}

/**
 * Webhook side of activation. Idempotent: a replayed event finds paidAt already
 * set and returns without touching anything.
 */
export async function markCollaborationPaid(input: {
  collaborationId: string;
  paymentIntentId: string;
}) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from collaborations where id = ${input.collaborationId} for update`,
    );
    const [c] = await tx
      .select()
      .from(collaborations)
      .where(eq(collaborations.id, input.collaborationId))
      .limit(1);
    if (!c || c.paidAt) return;
    if (c.status !== "Awaiting payment") return;

    const agreement = c.agreement as Terms;
    await tx
      .update(collaborations)
      .set({
        status: "Active",
        paidAt: new Date(),
        stripePaymentIntentId: input.paymentIntentId,
      })
      .where(eq(collaborations.id, c.id));

    // Paid work starts counting from activation, matching the demo behaviour.
    const deadline = new Date(Date.now() + (agreement.days || 7) * 86400000);
    await tx
      .update(contributions)
      .set({ deadlineAt: deadline })
      .where(eq(contributions.collaborationId, c.id));
  });
}

/**
 * Releases escrow to the performer once their delivery is approved.
 *
 * Runs after the approving transaction has committed so a Stripe failure cannot
 * roll back the approval, and is guarded by stripeTransferId so a repeat call
 * cannot pay twice.
 */
export async function releaseEscrow(collaborationId: string) {
  const db = getDb();
  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  if (!c) return;
  if ((c.agreement as Terms).mode !== "Paid") return;
  if (!c.paidAt || c.stripeTransferId || c.refundedAt) return;

  const performer = await performerFor(c.id, c.payerArtistId);
  if (!performer.stripeAccountId) return;

  const payout = c.amountCents - c.platformFeeCents;
  if (payout <= 0) return;

  const transfer = await getStripe().transfers.create(
    {
      amount: payout,
      currency: "eur",
      destination: performer.stripeAccountId,
      transfer_group: c.stripeTransferGroup ?? `collab_${c.id}`,
      metadata: { collaborationId: c.id },
    },
    { idempotencyKey: `transfer_${c.id}` },
  );

  await db
    .update(collaborations)
    .set({ stripeTransferId: transfer.id, releasedAt: new Date() })
    .where(and(eq(collaborations.id, c.id), sql`${collaborations.stripeTransferId} is null`));
}

/** Refunds a paid collaboration that ends up cancelled before release. */
export async function refundCollaboration(collaborationId: string) {
  const db = getDb();
  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  if (!c?.paidAt || !c.stripePaymentIntentId) return;
  if (c.stripeTransferId) throw new Error("This work was already paid out.");
  if (c.refundedAt) return;

  const refund = await getStripe().refunds.create(
    { payment_intent: c.stripePaymentIntentId },
    { idempotencyKey: `refund_${c.id}` },
  );

  await db
    .update(collaborations)
    .set({ stripeRefundId: refund.id, refundedAt: new Date() })
    .where(and(eq(collaborations.id, c.id), sql`${collaborations.refundedAt} is null`));
}

async function performerFor(collaborationId: string, payerArtistId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: artistProfiles.id,
      name: artistProfiles.name,
      stripeAccountId: artistProfiles.stripeAccountId,
      stripePayoutsEnabled: artistProfiles.stripePayoutsEnabled,
    })
    .from(collaborationParticipants)
    .innerJoin(artistProfiles, eq(collaborationParticipants.artistId, artistProfiles.id))
    .where(eq(collaborationParticipants.collaborationId, collaborationId));
  const performer = rows.find((r) => r.id !== payerArtistId);
  if (!performer) throw new Error("Performer not found.");
  return performer;
}

export type { Tx };
