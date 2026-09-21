import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const root = resolve(import.meta.dirname, "..");
export const envLocalPath = resolve(root, ".env.local");
export const envExamplePath = resolve(root, ".env.example");

/** Parse KEY=VALUE lines; does not expand shell vars. */
export function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Load .env.local into process.env without overwriting existing keys. */
export function loadEnvLocal() {
  const parsed = parseEnvFile(envLocalPath);
  for (const [k, v] of Object.entries(parsed)) {
    if (!(k in process.env)) process.env[k] = v;
  }
  return parsed;
}

export function mask(value) {
  if (!value) return "(empty)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

/**
 * Upsert keys in .env.local. Preserves comments/unknown lines when possible
 * by rewriting a clean file from known keys + leftover.
 */
export function upsertEnvLocal(updates) {
  const existing = parseEnvFile(envLocalPath);
  const merged = { ...existing, ...updates };
  const header = `# Generated/updated by scripts/go-live.mjs — do not commit
# Full checklist: docs/GO_LIVE.md
`;
  const order = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_DEMO",
    "PAYMENTS_ENABLED",
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "AUTH_URL",
    "BLOB_READ_WRITE_TOKEN",
    "CRON_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "PLATFORM_FEE_BPS",
    "SENTRY_DSN",
    "NEXT_PUBLIC_SENTRY_DSN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ];
  const lines = [header.trimEnd(), ""];
  const seen = new Set();
  for (const key of order) {
    if (merged[key] === undefined) continue;
    lines.push(`${key}=${merged[key]}`);
    seen.add(key);
  }
  for (const [key, val] of Object.entries(merged)) {
    if (seen.has(key)) continue;
    lines.push(`${key}=${val}`);
  }
  lines.push("");
  writeFileSync(envLocalPath, lines.join("\n"), { mode: 0o600 });
  return merged;
}
