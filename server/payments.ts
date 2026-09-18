// Server-only payment helpers. Imported by Server Actions and the Stripe
// webhook; never reachable directly from the browser.
import { and, eq, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  artistProfiles,
  collaborationParticipants,
  collaborations,
  contributions,
} from "@/db/schema";
import type { Terms } from "@/domain/model";
import { decideIncomingPayment } from "@/lib/payment-decisions";
import { captureException } from "@/lib/monitoring";
import { appUrl, getStripe, platformFeeCents } from "@/server/stripe";

const MAX_SETTLEMENT_ATTEMPTS = 25;

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
 *
 * Card-only: async methods would leave the collab stuck until a second event,
 * which we handle but do not advertise.
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
      // Restrict to sync methods so activation does not depend on a second event.
      payment_method_types: ["card"],
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

/** Best-effort close of an open Checkout after the collab is cancelled unpaid. */
export async function expireOpenCheckout(collaborationId: string) {
  const db = getDb();
  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  if (!c?.stripeCheckoutSessionId || c.paidAt) return;
  try {
    await getStripe().checkout.sessions.expire(c.stripeCheckoutSessionId);
  } catch (error) {
    // Already complete / expired: the webhook path handles late money.
    console.warn("Checkout expire skipped", collaborationId, (error as Error).message);
  }
}

/**
 * Webhook side of payment confirmation. Idempotent.
 *
 * - Awaiting payment → Active + start the delivery clock.
 * - Cancelled (or any non-activatable state) with a late charge → record the
 *   PaymentIntent and enqueue a recoverable refund. Never silently drop money.
 */
export async function markCollaborationPaid(input: {
  collaborationId: string;
  paymentIntentId: string;
}) {
  const db = getDb();
  let enqueueRefund = false;

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from collaborations where id = ${input.collaborationId} for update`,
    );
    const [c] = await tx
      .select()
      .from(collaborations)
      .where(eq(collaborations.id, input.collaborationId))
      .limit(1);
    if (!c) return;

    const decision = decideIncomingPayment(c);

    if (decision === "noop") return;

    if (decision === "enqueue_refund") {
      await tx
        .update(collaborations)
        .set({
          settlementStatus: "refund_pending",
          settlementNextAttemptAt: new Date(),
        })
        .where(eq(collaborations.id, c.id));
      enqueueRefund = true;
      return;
    }

    if (decision === "activate") {
      const agreement = c.agreement as Terms;
      await tx
        .update(collaborations)
        .set({
          status: "Active",
          paidAt: new Date(),
          stripePaymentIntentId: input.paymentIntentId,
        })
        .where(eq(collaborations.id, c.id));

      const deadline = new Date(Date.now() + (agreement.days || 7) * 86400000);
      await tx
        .update(contributions)
        .set({ deadlineAt: deadline })
        .where(eq(contributions.collaborationId, c.id));
      return;
    }

    // record_and_refund — late payment after cancel / unexpected state
    await tx
      .update(collaborations)
      .set({
        paidAt: new Date(),
        stripePaymentIntentId: input.paymentIntentId,
        settlementStatus: "refund_pending",
        settlementNextAttemptAt: new Date(),
        settlementLastError: null,
      })
      .where(eq(collaborations.id, c.id));
    enqueueRefund = true;
  });

  if (enqueueRefund) {
    try {
      await refundCollaboration(input.collaborationId);
    } catch (error) {
      await captureException(error, {
        tags: { area: "late_refund", collaborationId: input.collaborationId },
      });
    }
  }
}

export async function enqueueRelease(collaborationId: string) {
  const db = getDb();
  await db
    .update(collaborations)
    .set({
      settlementStatus: "release_pending",
      settlementNextAttemptAt: new Date(),
      settlementLastError: null,
    })
    .where(
      and(
        eq(collaborations.id, collaborationId),
        sql`${collaborations.settlementStatus} not in ('released', 'refunded')`,
      ),
    );
}

export async function enqueueRefund(collaborationId: string) {
  const db = getDb();
  await db
    .update(collaborations)
    .set({
      settlementStatus: "refund_pending",
      settlementNextAttemptAt: new Date(),
      settlementLastError: null,
    })
    .where(
      and(
        eq(collaborations.id, collaborationId),
        sql`${collaborations.settlementStatus} not in ('released', 'refunded')`,
      ),
    );
}

/**
 * Releases escrow to the performer once their delivery is approved.
 *
 * Failures leave settlementStatus=release_pending with a backoff timestamp so
 * drainSettlementQueue (or the next webhook/reconcile pass) can retry.
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
  if (c.settlementStatus === "released" || c.settlementStatus === "refunded") return;

  const performer = await performerFor(c.id, c.payerArtistId);
  if (!performer.stripeAccountId) {
    await markSettlementFailure(c.id, "release_pending", "Performer has no Stripe account.");
    return;
  }

  const payout = c.amountCents - c.platformFeeCents;
  if (payout <= 0) {
    await db
      .update(collaborations)
      .set({
        settlementStatus: "released",
        releasedAt: new Date(),
        settlementLastError: null,
        settlementNextAttemptAt: null,
      })
      .where(eq(collaborations.id, c.id));
    return;
  }

  try {
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
      .set({
        stripeTransferId: transfer.id,
        releasedAt: new Date(),
        settlementStatus: "released",
        settlementLastError: null,
        settlementNextAttemptAt: null,
      })
      .where(
        and(eq(collaborations.id, c.id), sql`${collaborations.stripeTransferId} is null`),
      );
  } catch (error) {
    await markSettlementFailure(c.id, "release_pending", (error as Error).message);
    await captureException(error, {
      tags: { area: "release_escrow", collaborationId },
    });
    throw error;
  }
}

/** Refunds a paid collaboration that ends up cancelled before release. */
export async function refundCollaboration(collaborationId: string) {
  const db = getDb();
  const [c] = await db
    .select()
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  if (!c) return;
  if (c.stripeTransferId) throw new Error("This work was already paid out.");
  if (c.refundedAt || c.settlementStatus === "refunded") return;
  if (!c.paidAt || !c.stripePaymentIntentId) return;

  try {
    const refund = await getStripe().refunds.create(
      { payment_intent: c.stripePaymentIntentId },
      { idempotencyKey: `refund_${c.id}` },
    );

    await db
      .update(collaborations)
      .set({
        stripeRefundId: refund.id,
        refundedAt: new Date(),
        settlementStatus: "refunded",
        settlementLastError: null,
        settlementNextAttemptAt: null,
      })
      .where(and(eq(collaborations.id, c.id), sql`${collaborations.refundedAt} is null`));
  } catch (error) {
    await markSettlementFailure(c.id, "refund_pending", (error as Error).message);
    await captureException(error, {
      tags: { area: "refund", collaborationId },
    });
    throw error;
  }
}

/**
 * Retries pending releases/refunds whose backoff window has elapsed.
 * Safe to call from the webhook and from a cron reconcile route.
 */
export async function drainSettlementQueue(limit = 20) {
  const db = getDb();
  const now = new Date();
  const due = await db
    .select({ id: collaborations.id, settlementStatus: collaborations.settlementStatus })
    .from(collaborations)
    .where(
      and(
        or(
          eq(collaborations.settlementStatus, "release_pending"),
          eq(collaborations.settlementStatus, "refund_pending"),
        ),
        or(
          sql`${collaborations.settlementNextAttemptAt} is null`,
          lt(collaborations.settlementNextAttemptAt, now),
        ),
        sql`${collaborations.settlementAttempts} < ${MAX_SETTLEMENT_ATTEMPTS}`,
      ),
    )
    .limit(limit);

  for (const row of due) {
    try {
      if (row.settlementStatus === "release_pending") await releaseEscrow(row.id);
      else await refundCollaboration(row.id);
    } catch (error) {
      console.error("Settlement retry failed", row.id, error);
    }
  }
  return due.length;
}

async function markSettlementFailure(
  collaborationId: string,
  status: "release_pending" | "refund_pending",
  message: string,
) {
  const db = getDb();
  const [c] = await db
    .select({ attempts: collaborations.settlementAttempts })
    .from(collaborations)
    .where(eq(collaborations.id, collaborationId))
    .limit(1);
  const attempts = (c?.attempts ?? 0) + 1;
  // Exponential backoff capped at one hour so operators see progress soon.
  const delayMs = Math.min(2 ** Math.min(attempts, 10) * 30_000, 60 * 60 * 1000);
  await db
    .update(collaborations)
    .set({
      settlementStatus: status,
      settlementAttempts: attempts,
      settlementLastError: message.slice(0, 2000),
      settlementNextAttemptAt: new Date(Date.now() + delayMs),
    })
    .where(eq(collaborations.id, collaborationId));
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
