import assert from "node:assert/strict";
import {
  assertPaymentsReady,
  decideIncomingPayment,
  webhookClaimOutcome,
} from "../lib/payment-decisions.ts";
import { assertOwnedBlobPath } from "../lib/blob-ownership.ts";
import { paymentsEnabled } from "../lib/flags.ts";

// --- Payments gate (real helpers, not a local stub) ---------------------

assert.throws(
  () => assertPaymentsReady({ paymentsEnabled: false, stripeConfigured: false }),
  /Payments are not available yet/,
);
assert.throws(
  () => assertPaymentsReady({ paymentsEnabled: true, stripeConfigured: false }),
  /Payment provider is not configured/,
);
assert.equal(
  assertPaymentsReady({ paymentsEnabled: true, stripeConfigured: true }),
  undefined,
);

process.env.PAYMENTS_ENABLED = "0";
assert.equal(paymentsEnabled(), false);
process.env.PAYMENTS_ENABLED = "1";
assert.equal(paymentsEnabled(), true);
delete process.env.PAYMENTS_ENABLED;

console.log("PASS Payments gate uses shared assertPaymentsReady + flags");

// --- Blob ownership (#1) ------------------------------------------------

assert.doesNotThrow(() =>
  assertOwnedBlobPath(
    { pathname: "demos/user-A/track.wav" },
    { userId: "user-A", kind: "demo" },
  ),
);
assert.throws(
  () =>
    assertOwnedBlobPath(
      { pathname: "demos/OTHER-USER/private-name.wav" },
      { userId: "user-A", kind: "demo" },
    ),
  /Invalid upload/,
);
assert.throws(
  () =>
    assertOwnedBlobPath(
      { pathname: "deliveries/user-A/file.zip" },
      { userId: "user-A", kind: "demo" },
    ),
  /Invalid upload/,
);
assert.doesNotThrow(() =>
  assertOwnedBlobPath(
    { pathname: "deliveries/user-A/file.zip" },
    { userId: "user-A", kind: "delivery" },
  ),
);
console.log("PASS Blob ownership rejects foreign pathnames");

// --- Late payment on cancelled collab (#2) ------------------------------

assert.equal(
  decideIncomingPayment({
    status: "Awaiting payment",
    paidAt: null,
    refundedAt: null,
    settlementStatus: "none",
  }),
  "activate",
);
assert.equal(
  decideIncomingPayment({
    status: "Cancelled",
    paidAt: null,
    refundedAt: null,
    settlementStatus: "none",
  }),
  "record_and_refund",
);
assert.equal(
  decideIncomingPayment({
    status: "Cancelled",
    paidAt: new Date(),
    refundedAt: null,
    settlementStatus: "none",
  }),
  "enqueue_refund",
);
assert.equal(
  decideIncomingPayment({
    status: "Cancelled",
    paidAt: new Date(),
    refundedAt: new Date(),
    settlementStatus: "refunded",
  }),
  "noop",
);
assert.equal(
  decideIncomingPayment({
    status: "Active",
    paidAt: new Date(),
    refundedAt: null,
    settlementStatus: "none",
  }),
  "noop",
);
console.log("PASS Late payment on cancelled collab enqueues refund");

// --- Webhook lease reclaim (#4) -----------------------------------------

const now = new Date("2026-09-18T12:00:00Z");
assert.equal(webhookClaimOutcome(null, now), "insert");
assert.equal(
  webhookClaimOutcome({ status: "completed", leaseUntil: null }, now),
  "duplicate",
);
assert.equal(
  webhookClaimOutcome(
    { status: "processing", leaseUntil: new Date("2026-09-18T12:01:00Z") },
    now,
  ),
  "duplicate",
);
assert.equal(
  webhookClaimOutcome(
    { status: "processing", leaseUntil: new Date("2026-09-18T11:59:00Z") },
    now,
  ),
  "reclaim",
);
assert.equal(
  webhookClaimOutcome({ status: "failed", leaseUntil: new Date(0) }, now),
  "reclaim",
);
console.log("PASS Webhook claim distinguishes completed vs reclaimable lease");

console.log("hardening scenarios passed.");
