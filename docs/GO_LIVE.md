# Production go-live checklist (Trade-first)

Whatafeat soft-launches with **Trade + Open Verses** on real Neon/Auth/Blob.
Leave **Paid off** (`PAYMENTS_ENABLED` unset) until [STRIPE_TEST_MATRIX.md](./STRIPE_TEST_MATRIX.md) is green, then follow [PAID_LIVE_RUNBOOK.md](./PAID_LIVE_RUNBOOK.md).

## 1. External accounts

- [ ] [Neon](https://neon.tech) project created
- [ ] Copy **pooled** `DATABASE_URL` for the app (`?sslmode=require`)
- [ ] If `drizzle-kit migrate` fails on the pooler, also set a **direct** URL for migrate only
- [ ] Google Cloud OAuth client (Web)
  - Authorized redirect (local): `http://localhost:3000/api/auth/callback/google`
  - Authorized redirect (prod): `https://<your-domain>/api/auth/callback/google`
- [ ] [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store → `BLOB_READ_WRITE_TOKEN`
- [ ] Custom domain on Vercel → set `NEXT_PUBLIC_APP_URL=https://<your-domain>`

## 2. Apply migrations (Production)

Never use `npm run db:push` against Production. Only migrate from files in `drizzle/`.

```sh
# From the repo root, with DATABASE_URL pointing at Neon:
cp .env.example .env.local   # fill DATABASE_URL
npm ci
npm run db:migrate           # applies 0000 → 0001 → 0002 in order
```

Confirm in the Neon SQL editor that `__drizzle_migrations` lists all three and that
`collaborations.settlement_status` and `stripe_events.status` exist.

## 3. Vercel Production env

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_DEMO` | `0` |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` |
| `DATABASE_URL` | Neon pooled URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth client |
| `BLOB_READ_WRITE_TOKEN` | Blob store token |
| `PAYMENTS_ENABLED` | unset / `0` until Paid live |
| `CRON_SECRET` | random secret (reconcile + Vercel cron) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | after Sentry project exists |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | after Upstash DB exists |

Redeploy after setting env.

## 4. Smoke acceptance (two Google accounts)

Run on the production (or staging) URL with `NEXT_PUBLIC_DEMO=0`.

- [ ] Account A: sign in → onboarding → upload profile demo → publish Trade offer and/or open verse
- [ ] Account B: discover A → send Trade proposal → A accepts
- [ ] Both: open room → upload delivery → request revision → approve → Completed
- [ ] Leave a review; open A's profile **signed out** — review is visible
- [ ] Signed out: Network tab on bootstrap / first paint — no other users' proposals, messages, or deliveries
- [ ] Profile without demo: Play is disabled (no synthetic WAV)
- [ ] Delivery download only via `/api/assets/<id>` while signed in as participant
- [ ] Paid CTA stays gated / “not available yet” while `PAYMENTS_ENABLED≠1`

**Exit:** Trade path stable on the public domain; Paid still off.
