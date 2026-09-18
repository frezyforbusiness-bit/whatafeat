import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Lazily built Stripe client. Constructed on first use so the app still boots
 * (and demo mode still works) when no keys are configured.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Payments are not configured.");
  client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return client;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Platform commission in basis points (100 = 1%). Withheld from the transfer to
 * the performer rather than added on top of what the payer agreed to.
 */
export const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? 0);

export function platformFeeCents(amountCents: number) {
  if (!PLATFORM_FEE_BPS) return 0;
  return Math.floor((amountCents * PLATFORM_FEE_BPS) / 10000);
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
