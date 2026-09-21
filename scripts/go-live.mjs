#!/usr/bin/env node
/**
 * Automate Trade soft-launch as far as secrets allow.
 *
 * Usage:
 *   npm run go-live              # status + do everything possible
 *   npm run go-live -- status
 *   npm run go-live -- prepare   # scaffold .env.local + generate secrets
 *   npm run go-live -- migrate   # drizzle migrate through 0003
 *   npm run go-live -- vercel-sync
 *   npm run go-live -- deploy    # vercel --prod (if linked)
 *
 * Env sources: process.env, then .env.local
 * Vercel: VERCEL_TOKEN or `npx vercel login` (interactive once)
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  envLocalPath,
  loadEnvLocal,
  mask,
  parseEnvFile,
  root,
  upsertEnvLocal,
} from "./env-file.mjs";

const cmd = process.argv[2] || "all";

const TRADE_KEYS = [
  "NEXT_PUBLIC_DEMO",
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "BLOB_READ_WRITE_TOKEN",
];

const OPTIONAL_SOFT = ["CRON_SECRET", "AUTH_URL"];

const MIGRATION_TAGS = [
  "0000_powerful_slyde",
  "0001_keen_natasha_romanoff",
  "0002_slimy_titania",
  "0003_artist_profile_onboarding",
];

const xdg = {
  XDG_DATA_HOME: resolve(root, ".vercel-xdg/share"),
  XDG_CACHE_HOME: resolve(root, ".vercel-xdg/cache"),
  XDG_CONFIG_HOME: resolve(root, ".vercel-xdg/config"),
};

function log(msg) {
  console.log(msg);
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

function run(command, args, opts = {}) {
  const res = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...xdg, ...opts.env },
    stdio: opts.stdio ?? "inherit",
    shell: false,
  });
  return res;
}

function npxVercel(args, opts = {}) {
  return run("npx", ["--yes", "vercel", ...args], opts);
}

function vercelLoggedIn() {
  if (process.env.VERCEL_TOKEN?.trim()) return true;
  const res = npxVercel(["whoami"], { stdio: "pipe" });
  const out = `${res.stdout || ""}${res.stderr || ""}`;
  if (res.status === 0 && !/login_required|not.*logged/i.test(out)) return true;
  return false;
}

function filled(key) {
  return Boolean(process.env[key]?.trim());
}

function statusReport() {
  loadEnvLocal();
  log("=== Whatafeat go-live status (Trade soft launch) ===\n");
  log(`.env.local: ${existsSync(envLocalPath) ? "present" : "MISSING — run: npm run go-live -- prepare"}`);
  log(`NEXT_PUBLIC_DEMO: ${process.env.NEXT_PUBLIC_DEMO ?? "(unset)"} ${process.env.NEXT_PUBLIC_DEMO === "0" ? "✓ prod mode" : "→ still demo"}`);
  log(`PAYMENTS_ENABLED: ${process.env.PAYMENTS_ENABLED ?? "(unset)"} ${process.env.PAYMENTS_ENABLED === "1" ? "⚠ Paid ON" : "✓ Paid off"}`);
  log("");
  log("Required for Trade:");
  for (const key of TRADE_KEYS) {
    const ok = filled(key);
    const note =
      key === "NEXT_PUBLIC_DEMO"
        ? process.env.NEXT_PUBLIC_DEMO === "0"
          ? "ok"
          : "must be 0"
        : ok
          ? mask(process.env[key])
          : "MISSING";
    log(`  ${ok && (key !== "NEXT_PUBLIC_DEMO" || process.env.NEXT_PUBLIC_DEMO === "0") ? "✓" : "✗"} ${key}: ${note}`);
  }
  log("\nOptional:");
  for (const key of OPTIONAL_SOFT) {
    log(`  ${filled(key) ? "✓" : "·"} ${key}: ${filled(key) ? mask(process.env[key]) : "(unset)"}`);
  }
  log(`\nVercel CLI: ${vercelLoggedIn() ? "logged in / token set" : "not logged in — set VERCEL_TOKEN or run vercel login"}`);
  log(`Migrations expected: ${MIGRATION_TAGS.join(" → ")}`);
  log("\nManual once (cannot fully automate):");
  log("  1) Neon project → DATABASE_URL (pooled ?sslmode=require)");
  log("  2) Google OAuth → AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET + redirect URIs");
  log("  3) Vercel Blob → BLOB_READ_WRITE_TOKEN");
  log("  4) Paste into .env.local then: npm run go-live");
  log("\nDocs: docs/GO_LIVE.md");
}

function prepare() {
  loadEnvLocal();
  const updates = {};
  if (!filled("NEXT_PUBLIC_DEMO") || process.env.NEXT_PUBLIC_DEMO !== "0") {
    updates.NEXT_PUBLIC_DEMO = "0";
  }
  if (!filled("NEXT_PUBLIC_APP_URL")) {
    updates.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  }
  if (!filled("AUTH_SECRET")) {
    updates.AUTH_SECRET = randomBytes(32).toString("base64");
  }
  if (!filled("CRON_SECRET")) {
    updates.CRON_SECRET = randomBytes(24).toString("hex");
  }
  if (!filled("PAYMENTS_ENABLED")) {
    updates.PAYMENTS_ENABLED = "0";
  }
  // Keep placeholders so the file is a clear checklist
  const file = parseEnvFile(envLocalPath);
  for (const key of ["DATABASE_URL", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "BLOB_READ_WRITE_TOKEN"]) {
    if (!(key in file) && !filled(key)) updates[key] = "";
  }
  upsertEnvLocal(updates);
  log(`Wrote ${envLocalPath}`);
  log(`  AUTH_SECRET: ${mask(updates.AUTH_SECRET || process.env.AUTH_SECRET)}`);
  log(`  CRON_SECRET: ${mask(updates.CRON_SECRET || process.env.CRON_SECRET)}`);
  log(`  NEXT_PUBLIC_DEMO=0`);
  log("\nFill DATABASE_URL, AUTH_GOOGLE_*, BLOB_READ_WRITE_TOKEN, then re-run:");
  log("  npm run go-live");
}

function migrate() {
  loadEnvLocal();
  if (!filled("DATABASE_URL")) {
    fail("DATABASE_URL missing. Create Neon, paste into .env.local, then retry migrate.");
  }
  log("Running drizzle migrate (0000 → 0003)…");
  const res = run("npm", ["run", "db:migrate"], {
    env: { DATABASE_URL: process.env.DATABASE_URL },
  });
  if (res.status !== 0) {
    fail(
      "db:migrate failed. If using Neon pooler, try a direct (non-pooler) DATABASE_URL for migrate only — see docs/GO_LIVE.md.",
      res.status ?? 1,
    );
  }
  log("Migrate OK. Confirm tags in Neon: " + MIGRATION_TAGS.join(", "));
}

function vercelSync() {
  loadEnvLocal();
  if (!vercelLoggedIn()) {
    fail(
      "Vercel not authenticated. Export VERCEL_TOKEN=… (https://vercel.com/account/tokens) or run:\n  npx vercel login\nthen: npm run go-live -- vercel-sync",
    );
  }
  if (!existsSync(resolve(root, ".vercel/project.json")) && !process.env.VERCEL_PROJECT_ID) {
    log("Linking project (non-interactive if already known)…");
    const link = npxVercel(["link", "--yes"]);
    if (link.status !== 0) {
      fail("vercel link failed. Run once interactively: npx vercel link");
    }
  }

  const file = { ...parseEnvFile(envLocalPath), ...Object.fromEntries(
    TRADE_KEYS.concat(OPTIONAL_SOFT, ["PAYMENTS_ENABLED"]).map((k) => [k, process.env[k]]),
  ) };

  // Force soft-launch defaults on Production
  const toSync = {
    NEXT_PUBLIC_DEMO: "0",
    PAYMENTS_ENABLED: file.PAYMENTS_ENABLED === "1" ? "1" : "0",
  };
  for (const key of TRADE_KEYS.concat(OPTIONAL_SOFT)) {
    if (key === "NEXT_PUBLIC_DEMO") continue;
    if (file[key]?.trim()) toSync[key] = file[key].trim();
  }

  const missing = TRADE_KEYS.filter((k) => k !== "NEXT_PUBLIC_DEMO" && !toSync[k]);
  if (missing.length) {
    warn(`Skipping incomplete keys (fill .env.local first): ${missing.join(", ")}`);
  }

  for (const [key, value] of Object.entries(toSync)) {
    if (!value) continue;
    log(`Sync ${key} → Production…`);
    // Remove existing then add (vercel env add fails if exists)
    npxVercel(["env", "rm", key, "production", "--yes"], { stdio: "pipe" });
    const add = spawnSync(
      "npx",
      ["--yes", "vercel", "env", "add", key, "production"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, ...xdg },
        input: value,
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
    if (add.status !== 0) {
      fail(`Failed to set ${key} on Vercel`);
    }
  }
  log("Vercel Production env updated. Redeploy with: npm run go-live -- deploy");
}

function deploy() {
  if (!vercelLoggedIn()) {
    fail("Vercel not authenticated.");
  }
  log("Deploying Production…");
  const res = npxVercel(["deploy", "--prod", "--yes"]);
  if (res.status !== 0) fail("vercel deploy failed", res.status ?? 1);
}

function runCheck() {
  const res = run("node", ["scripts/check-prod-env.mjs"]);
  return res.status === 0;
}

function neonCreate() {
  loadEnvLocal();
  const key = process.env.NEON_API_KEY?.trim();
  if (!key) {
    fail(
      "NEON_API_KEY missing. Create one at https://console.neon.tech/app/settings/api-keys then:\n  export NEON_API_KEY=…\n  npm run go-live -- neon",
    );
  }
  if (filled("DATABASE_URL")) {
    log(`DATABASE_URL already set (${mask(process.env.DATABASE_URL)}). Skipping Neon create.`);
    return;
  }
  log("Creating Neon project via neonctl…");
  const res = spawnSync(
    "npx",
    [
      "--yes",
      "neonctl@latest",
      "projects",
      "create",
      "--name",
      "whatafeat",
      "--region-id",
      "aws-eu-central-1",
      "--output",
      "json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NEON_API_KEY: key, ...xdg },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    fail("neonctl projects create failed");
  }
  let parsed;
  try {
    parsed = JSON.parse(res.stdout || "{}");
  } catch {
    fail("Could not parse neonctl JSON output:\n" + res.stdout);
  }
  // neonctl shapes vary; try common fields
  const connection =
    parsed?.connection_uris?.[0]?.connection_uri ||
    parsed?.connectionUri ||
    parsed?.project?.connection_uris?.[0]?.connection_uri ||
    parsed?.databases?.[0]?.connection_uri;
  const projectId = parsed?.project?.id || parsed?.id;
  if (!connection && projectId) {
    log(`Project ${projectId} created; fetching connection string…`);
    const cs = spawnSync(
      "npx",
      ["--yes", "neonctl@latest", "connection-string", "--project-id", projectId, "--pooled"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, NEON_API_KEY: key, ...xdg },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (cs.status !== 0) {
      console.error(cs.stderr || cs.stdout);
      fail("Failed to fetch Neon connection string");
    }
    const url = (cs.stdout || "").trim();
    if (!url.startsWith("postgres")) fail("Unexpected connection string from neonctl");
    upsertEnvLocal({ DATABASE_URL: url.includes("sslmode=") ? url : `${url}${url.includes("?") ? "&" : "?"}sslmode=require` });
    log(`Wrote DATABASE_URL (${mask(url)})`);
    return;
  }
  if (!connection) {
    fail("Neon project created but no connection URI found. Paste DATABASE_URL manually.\n" + res.stdout);
  }
  const url = connection.includes("sslmode=")
    ? connection
    : `${connection}${connection.includes("?") ? "&" : "?"}sslmode=require`;
  upsertEnvLocal({ DATABASE_URL: url });
  log(`Wrote DATABASE_URL (${mask(url)})`);
}

function all() {
  statusReport();
  log("\n=== Automating what we can ===\n");

  if (!existsSync(envLocalPath) || !filled("AUTH_SECRET")) {
    log("→ prepare (.env.local scaffold + secrets)");
    prepare();
    loadEnvLocal();
  } else if (process.env.NEXT_PUBLIC_DEMO !== "0") {
    log("→ forcing NEXT_PUBLIC_DEMO=0 in .env.local");
    upsertEnvLocal({ NEXT_PUBLIC_DEMO: "0" });
    loadEnvLocal();
  }

  if (!filled("DATABASE_URL") && process.env.NEON_API_KEY?.trim()) {
    log("→ neon (NEON_API_KEY present)");
    neonCreate();
    loadEnvLocal();
  }

  if (filled("DATABASE_URL")) {
    log("→ migrate");
    migrate();
  } else {
    warn("Skip migrate — no DATABASE_URL yet (set NEON_API_KEY or paste URL)");
  }

  if (vercelLoggedIn()) {
    const ready = TRADE_KEYS.every(
      (k) => k === "NEXT_PUBLIC_DEMO" || filled(k),
    );
    if (ready) {
      log("→ vercel-sync");
      vercelSync();
      log("→ deploy");
      deploy();
    } else {
      warn("Skip vercel-sync — fill remaining Trade keys in .env.local first");
      statusReport();
    }
  } else {
    warn("Skip Vercel — set VERCEL_TOKEN or: npx vercel login");
  }

  log("\n=== Env check ===");
  runCheck();
  log("\nDone with automated steps. Remaining manual: Google / Blob if still missing, then smoke docs/GO_LIVE.md §4.");
}

const handlers = {
  status: statusReport,
  prepare,
  migrate,
  neon: neonCreate,
  "vercel-sync": vercelSync,
  deploy,
  check: () => {
    if (!runCheck()) process.exit(1);
  },
  all,
};

if (!handlers[cmd]) {
  fail(`Unknown command "${cmd}". Use: status | prepare | neon | migrate | vercel-sync | deploy | check | all`);
}

handlers[cmd]();
