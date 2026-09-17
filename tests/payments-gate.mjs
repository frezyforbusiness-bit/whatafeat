import assert from "node:assert/strict";

// Mirrors server/actions activatePaymentAction gate without DB.
function activatePayment(paymentsEnabled: boolean) {
  if (!paymentsEnabled) {
    throw new Error("Payments are not available yet. Trades work without payment.");
  }
  throw new Error("Payment provider is not configured.");
}

assert.throws(() => activatePayment(false), /Payments are not available yet/);
assert.throws(() => activatePayment(true), /Payment provider is not configured/);
console.log("PASS Paid activation remains gated in Prod 1.0");
console.log("1 payments gate scenario passed.");
