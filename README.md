# Whatafeat — Phase 1 prototype

Navigable demo for independent underground artists: discover collaborators, book paid features, trade verses, and post open verses.

Promise: **Find your next collaborator.**

Product plan: [`WHATAFEAT_PLAN.md`](./WHATAFEAT_PLAN.md). UI language: English.

## Requirements

- Node.js `>=22.13.0`
- Dependencies locked in `package-lock.json`

## Local development

```sh
cp .env.example .env.local   # optional
npm ci
npm run dev                  # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build (Vercel / Docker) |
| `npm run start` | Run the production build locally |
| `npm run test:domain` | Domain transition scenarios |
| `npm run typecheck` | TypeScript check |

Demo accounts and fixture state live in the browser (`localStorage` key `whatafeat-demo-v1`). Use **Choose demo account** (Sora / Nilo) and **Reset demo** in Settings.

Legacy Cloudflare/vinext scripts remain as `dev:vinext` / `build:vinext` / `start:vinext` for the original Sites starter path.

## Deploy on Vercel

1. Push this repo to GitHub (`whatafeat`).
2. In [Vercel](https://vercel.com): **Add New Project** → import the repo.
3. Framework Preset: **Next.js** (see `vercel.json`).
4. Env (optional for Phase 1): copy from `.env.example` — nothing secret is required.
5. Deploy. Open the production URL and walk the demo path.

CLI alternative:

```sh
npx vercel          # preview
npx vercel --prod   # production
```

## Docker (optional self-host)

Vercel does **not** use this Dockerfile. It is for Railway, Fly.io, or a VPS:

```sh
docker build -t whatafeat .
docker run --rm -p 3000:3000 whatafeat
```

## What works in Phase 1

- Discover, Explore, artist profiles, open verses list/detail
- Persistent audio player with synthesized WAV demos (`public/audio/`)
- Search + filters serialized in the URL
- Proposals (Paid / Trade), Studio, Inbox, collaboration room
- Simulated payment activation (`Simulate payment`)
- Domain rules in `domain/model.ts` with tests in `tests/domain.mjs`

## What is simulated / out of scope

- No real authentication, payments, webhooks, or payouts
- No server database in production yet
- Delivery file blobs are session-only; after refresh only metadata remains
- Permissions are enforced in client-side domain code only — **not production-safe**

## Project layout

```text
app/            Next.js layout, styles, catch-all route
features/       App shell UI + persistent player
domain/         Models and state transitions
mocks/          Fixtures + localStorage repository
components/ui/  Shared UI primitives
public/         Artwork + demo audio
vercel.json     Vercel project settings
Dockerfile      Optional container image
.env.example    Documented environment variables
```

## Next steps (Phase 2+)

1. Real accounts, authorization, and repository backends
2. Object storage for demos and deliveries
3. Keep trades live; gate Paid activation until a real payment provider exists
4. Remove demo account / reset / simulate-payment controls from production builds
