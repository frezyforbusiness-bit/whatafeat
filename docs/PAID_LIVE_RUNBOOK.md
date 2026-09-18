# Paid live runbook

Turn on real money only after [STRIPE_TEST_MATRIX.md](./STRIPE_TEST_MATRIX.md) is fully green.

## Pre-flight

- [ ] Stripe **live** platform account: business profile, public details, bank account (EU)
- [ ] Connect Express enabled for your platform
- [ ] Live webhook endpoint on Production URL (`/api/stripe/webhook`) with the same event set as test
- [ ] Counsel reviewed `/privacy` and `/terms` placeholders
- [ ] `CRON_SECRET` set; Vercel cron hitting `/api/stripe/reconcile` every 15 minutes
- [ ] Sentry DSN receiving events from staging
- [ ] Rollback plan understood: set `PAYMENTS_ENABLED=0` — Trade keeps working

## Cutover

1. In Vercel Production, set:
   - `STRIPE_SECRET_KEY=sk_live_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` (live endpoint signing secret)
   - `PAYMENTS_ENABLED=1`
   - `PLATFORM_FEE_BPS` (confirmed value, e.g. `250`)
2. Redeploy Production.
3. Verify bootstrap reports payments enabled for a signed-in user.
4. Two real artists: performer finishes Connect live onboarding → payer pays with a real card (small amount) → approve → confirm transfer in Stripe Dashboard.

## First 48 hours

- [ ] `settlement_status` queue empty (or draining via cron)
- [ ] Webhook events mostly `completed` in `stripe_events`
- [ ] No repeated Sentry “Settlement near attempt cap”
- [ ] Chargeback / dispute: manual — pause payouts if needed, contact Stripe support, document outcome (no in-app dispute UI yet)

## Rollback

```text
PAYMENTS_ENABLED=0
```

Redeploy (or instant env update + restart). Existing Active paid collabs keep their DB state; new Paid activation stops. Open Checkout sessions may still complete — webhook will activate or refund per current rules; monitor reconcile.
