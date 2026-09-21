# Whatafeat — Find your next collaborator

Demo mode (browser fixtures) + production mode (Neon, Auth.js, Vercel Blob, Stripe Connect escrow).

## Modes

| Mode | Flag | Behavior |
|---|---|---|
| Demo (default) | `NEXT_PUBLIC_DEMO=1` | localStorage fixtures, demo accounts, Simulate payment |
| Production | `NEXT_PUBLIC_DEMO=0` | Neon DB, Google sign-in, Blob uploads, Paid gated by Stripe |

Paid collaborations accept into `Awaiting payment` and stay there until Stripe is
configured: they need `PAYMENTS_ENABLED=1` **and** both `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`. Availability is reported by the server bootstrap only.

## Production go-live

Follow the checklists (do not skip migrations):

1. [docs/GO_LIVE.md](docs/GO_LIVE.md) — Trade soft launch (Neon, Auth, Blob, smoke)
2. [docs/STRIPE_TEST_MATRIX.md](docs/STRIPE_TEST_MATRIX.md) — Stripe test-mode certification
3. [docs/PAID_LIVE_RUNBOOK.md](docs/PAID_LIVE_RUNBOOK.md) — turn on live Paid

**Production schema changes:** `npm run db:migrate` only. Do **not** run `db:push` against Neon production.

## Payments (Stripe Connect, escrow)

Money moves between two users, so the platform uses Connect Express accounts and
holds funds until the work is approved:

1. The performer completes Connect onboarding from **Settings → Getting paid**.
   Paid offers cannot be published until payouts are enabled.
2. The payer opens Checkout. The charge lands on the **platform** account with a
   `transfer_group` — deliberately no `transfer_data`, so nothing reaches the
   performer yet.
3. `checkout.session.completed` arrives at `/api/stripe/webhook`, which flips the
   collaboration to `Active` and starts the delivery clock.
4. When the recipient approves the delivery, escrow is transferred minus
   `PLATFORM_FEE_BPS`. Failures stay in `settlement_status` and retry via cron.
5. A cancellation agreed before release refunds the payer. Late payments on a
   cancelled collab are recorded and refunded — never dropped.

Webhook claims use a lease (`stripe_events.status`). Vercel cron hits
`/api/stripe/reconcile` every 15 minutes (Authorization: `Bearer $CRON_SECRET`).

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/stripe/reconcile"
```

## Local demo (no secrets)

```sh
cp .env.example .env.local   # leave NEXT_PUBLIC_DEMO=1
npm ci
npm run dev                  # http://localhost:3000
```

## Production local setup

1. Neon project → `DATABASE_URL`
2. Google OAuth (redirect `http://localhost:3000/api/auth/callback/google`)
3. Vercel Blob → `BLOB_READ_WRITE_TOKEN`
4. Fill `.env.local` (`NEXT_PUBLIC_DEMO=0`, auth, blob, app URL)
5. `npm run db:migrate`   # through 0003_artist_profile_onboarding
6. `node scripts/check-prod-env.mjs`
7. `npm run dev` → Google sign-in → onboarding → upload profile demo → Trade flow

Optional: Sentry (`SENTRY_DSN`), Upstash (`UPSTASH_REDIS_REST_*`), Stripe test keys.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build |
| `npm test` | Domain + payments + hardening unit tests |
| `npm run typecheck` | TypeScript |
| `npm run db:migrate` | Apply SQL migrations (use this in Production) |
| `npm run db:generate` | Generate SQL from schema |
| `npm run db:push` | Dev-only schema push — **never on Production Neon** |

## Deploy (Vercel)

Import [frezyforbusiness-bit/whatafeat](https://github.com/frezyforbusiness-bit/whatafeat).
Set Production env from [docs/GO_LIVE.md](docs/GO_LIVE.md). Migrate Neon **before**
the first Live deploy. Region: `fra1`. Cron reconcile is configured in `vercel.json`.

## Architecture (Prod)

- [`db/schema.ts`](db/schema.ts) — Postgres tables
- [`auth.ts`](auth.ts) — Auth.js Google + Drizzle adapter
- [`server/actions.ts`](server/actions.ts) — mutations
- [`server/payments.ts`](server/payments.ts) — Stripe Checkout, escrow, refunds
- [`server/blob.ts`](server/blob.ts) — Vercel Blob uploads
- [`app/api/assets/[id]`](app/api/assets/[id]/route.ts) — authorized private downloads
- [`app/api/stripe/webhook`](app/api/stripe/webhook/route.ts) — payment activation
- [`app/api/stripe/reconcile`](app/api/stripe/reconcile/route.ts) — settlement retries
- [`features/app.tsx`](features/app.tsx) — UI (demo + prod)
- [`app/privacy`](app/privacy/page.tsx) / [`app/terms`](app/terms/page.tsx) — legal

## Acceptance

**Trade (required for soft launch):** two real accounts — onboarding → trade proposal →
accept → upload → revise/approve → completed → public review. No `localStorage` as
source of truth when `NEXT_PUBLIC_DEMO=0`.

**Paid (after Stripe matrix):** payout onboarding → Checkout (`4242…` in test) →
webhook activation → approval → transfer, verified in the Stripe dashboard.
