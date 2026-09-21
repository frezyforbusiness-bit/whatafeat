#!/usr/bin/env node
/**
 * Fail fast when intending production mode without required secrets.
 * Usage: node scripts/check-prod-env.mjs
 * Loads .env.local if present (does not print secret values).
 */
import { loadEnvLocal } from "./env-file.mjs";

loadEnvLocal();

const demo = process.env.NEXT_PUBLIC_DEMO;
if (demo !== "0") {
  console.log(
    `NEXT_PUBLIC_DEMO=${demo ?? "(unset)"} — still in demo mode. Set NEXT_PUBLIC_DEMO=0 for production.`,
  );
  process.exit(0);
}

const required = [
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "BLOB_READ_WRITE_TOKEN",
];

const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error("Production mode is on but missing required env:");
  for (const k of missing) console.error(`  - ${k}`);
  console.error("\nSee docs/GO_LIVE.md. Fill .env.local then: npm run go-live");
  process.exit(1);
}

if (process.env.PAYMENTS_ENABLED === "1") {
  const stripe = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CRON_SECRET"];
  const stripeMissing = stripe.filter((k) => !process.env[k]?.trim());
  if (stripeMissing.length) {
    console.error("PAYMENTS_ENABLED=1 but Stripe env incomplete:");
    for (const k of stripeMissing) console.error(`  - ${k}`);
    console.error("Follow docs/STRIPE_TEST_MATRIX.md and docs/PAID_LIVE_RUNBOOK.md first.");
    process.exit(1);
  }
  console.log("WARN: PAYMENTS_ENABLED=1 — ensure Stripe test matrix is green.");
} else {
  console.log("Paid is off (PAYMENTS_ENABLED unset/0) — Trade soft launch OK.");
}

console.log("Production env looks complete for Trade soft launch.");
console.log("Next: npm run go-live -- migrate (if not done), then smoke docs/GO_LIVE.md §4.");
