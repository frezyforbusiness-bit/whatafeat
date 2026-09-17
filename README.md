# Whatafeat — Find your next collaborator

Phase 1 demo (browser) + Phase 2 production foundation (Neon, Auth.js, Blob).

## Modes

| Mode | Flag | Behavior |
|---|---|---|
| Demo (default) | `NEXT_PUBLIC_DEMO=1` | localStorage fixtures, demo accounts, Simulate payment |
| Production | `NEXT_PUBLIC_DEMO=0` | Neon DB, Google sign-in, Blob uploads, Paid gated |

Paid collaborations accept into `Awaiting payment` but **cannot activate** until `PAYMENTS_ENABLED=1` (not in 1.0).

## Local demo (no secrets)

```sh
cp .env.example .env.local   # leave NEXT_PUBLIC_DEMO=1
npm ci
npm run dev                  # http://localhost:3000
```

## Production 1.0 local setup

1. Create a [Neon](https://neon.tech) project → copy `DATABASE_URL`
2. Create Google OAuth credentials (Authorized redirect: `http://localhost:3000/api/auth/callback/google`)
3. Create a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store → `BLOB_READ_WRITE_TOKEN`
4. Fill `.env.local`:

```env
NEXT_PUBLIC_DEMO=0
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
AUTH_SECRET=...                 # openssl rand -base64 32
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
BLOB_READ_WRITE_TOKEN=...
```

5. Apply schema:

```sh
npm run db:push
# or: npm run db:generate && npm run db:migrate
```

6. `npm run dev` → Sign in with Google → onboarding → trade flow

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build |
| `npm run test:domain` | Domain unit scenarios |
| `npm run typecheck` | TypeScript |
| `npm run db:push` | Push Drizzle schema to Neon |
| `npm run db:generate` | Generate SQL migrations |

## Deploy (Vercel)

Set the same env vars in the Vercel project (`NEXT_PUBLIC_DEMO=0`). Run migrations against Neon before/after first deploy. Import [frezyforbusiness-bit/whatafeat](https://github.com/frezyforbusiness-bit/whatafeat).

Optional Docker image uses `DOCKER_BUILD=1` (see `Dockerfile`). Vercel does not use the Dockerfile.

## Architecture (Prod)

- [`db/schema.ts`](db/schema.ts) — Postgres tables
- [`auth.ts`](auth.ts) — Auth.js Google + Drizzle adapter
- [`server/actions.ts`](server/actions.ts) — explicit mutations (trade active; paid gated)
- [`server/blob.ts`](server/blob.ts) — Vercel Blob uploads
- [`app/api/assets/[id]`](app/api/assets/[id]/route.ts) — authorized private downloads
- [`features/app.tsx`](features/app.tsx) — UI (demo + prod)

## 1.0 acceptance

Two real accounts: onboarding → trade proposal → accept → upload → revise/approve → completed. Paid shows “Payments coming soon”. No `localStorage` as source of truth when `NEXT_PUBLIC_DEMO=0`.
