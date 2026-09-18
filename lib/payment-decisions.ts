/** Pure helpers for payment + webhook decisions (unit-tested). */

export type CollabPaymentSnapshot = {
  status: string;
  paidAt: Date | string | null;
  refundedAt: Date | string | null;
  settlementStatus: string;
};

/**
 * What to do when Stripe confirms money for a collaboration.
 * Late charges on cancelled work must enqueue a refund — never drop silently.
 */
export function decideIncomingPayment(
  c: CollabPaymentSnapshot,
): "activate" | "enqueue_refund" | "record_and_refund" | "noop" {
  if (c.paidAt) {
    if (
      c.status === "Cancelled" &&
      !c.refundedAt &&
      c.settlementStatus !== "refunded" &&
      c.settlementStatus !== "released"
    ) {
      return "enqueue_refund";
    }
    return "noop";
  }
  if (c.status === "Awaiting payment") return "activate";
  return "record_and_refund";
}

export type StripeEventSnapshot = {
  status: string;
  leaseUntil: Date | string | null;
};

/**
 * Existence of an event id is not success. Only status=completed is final;
 * an expired lease may be reclaimed after a crash mid-handler.
 */
export function webhookClaimOutcome(
  existing: StripeEventSnapshot | null,
  now: Date = new Date(),
): "insert" | "reclaim" | "duplicate" {
  if (!existing) return "insert";
  if (existing.status === "completed") return "duplicate";
  const lease =
    existing.leaseUntil == null
      ? null
      : existing.leaseUntil instanceof Date
        ? existing.leaseUntil
        : new Date(existing.leaseUntil);
  if (!lease || lease.getTime() < now.getTime()) return "reclaim";
  return "duplicate";
}

/** Server-side gate used by activatePaymentAction (and the payments test). */
export function assertPaymentsReady(opts: {
  paymentsEnabled: boolean;
  stripeConfigured: boolean;
}) {
  if (!opts.paymentsEnabled) {
    throw new Error("Payments are not available yet. Trades work without payment.");
  }
  if (!opts.stripeConfigured) {
    throw new Error("Payment provider is not configured.");
  }
}
