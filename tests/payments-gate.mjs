import assert from "node:assert/strict";
import { assertPaymentsReady } from "../lib/payment-decisions.ts";
import { paymentsEnabled } from "../lib/flags.ts";
import { stripeConfigured } from "../server/stripe.ts";

/**
 * Uses the same guards as activatePaymentAction — not a local reimplementation.
 */
assert.throws(
  () =>
    assertPaymentsReady({
      paymentsEnabled: false,
      stripeConfigured: stripeConfigured(),
    }),
  /Payments are not available yet/,
);

process.env.PAYMENTS_ENABLED = "1";
assert.equal(paymentsEnabled(), true);
assert.throws(
  () =>
    assertPaymentsReady({
      paymentsEnabled: paymentsEnabled(),
      stripeConfigured: false,
    }),
  /Payment provider is not configured/,
);
delete process.env.PAYMENTS_ENABLED;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;

assert.equal(stripeConfigured(), false);
console.log("PASS Paid activation remains gated via shared payment decisions");
console.log("1 payments gate scenario passed.");
