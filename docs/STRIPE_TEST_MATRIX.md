# Stripe test-mode certification matrix

Do **not** set `PAYMENTS_ENABLED=1` on Production until every row below is green
on a staging / preview deployment with **test** keys.

## Setup

- [ ] Stripe test mode keys in staging env (`STRIPE_SECRET_KEY=sk_test_…`)
- [ ] Webhook endpoint → `https://<staging>/api/stripe/webhook`
  - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
    `checkout.session.async_payment_failed`, `account.updated`
- [ ] `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_ENABLED=1`, `PLATFORM_FEE_BPS=250`, `CRON_SECRET`
- [ ] Two Google test artists; performer completes **Settings → Getting paid** (Connect Express test)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Card: 4242 4242 4242 4242
```

## Matrix

| # | Scenario | Expected | Done |
|---|---|---|---|
| 1 | Happy path: pay → Active → approve → transfer | `paidAt` set, status Active then Completed, `settlement_status=released`, transfer in Stripe | [ ] |
| 2 | Cancel before pay | Checkout expired (or unusable); status Cancelled; no charge | [ ] |
| 3 | Pay then both agree cancel while Active | Refund; `settlement_status=refunded` | [ ] |
| 4 | Cancel Awaiting payment, then delayed `checkout.session.completed` | PaymentIntent recorded; refund enqueued/completed; collab stays Cancelled | [ ] |
| 5 | Simulate `transfers.create` failure once | Approval still Completed; `release_pending`; reconcile recovers transfer | [ ] |
| 6 | Duplicate webhook / crash after claim | First delivery processes; retry is duplicate or reclaim→idempotent; no double transfer | [ ] |
| 7 | Double-click Pay | Single Checkout session / single charge (idempotency key) | [ ] |
| 8 | Publish Paid offer without payouts | Server rejects; UI shows payout setup | [ ] |

## Unit coverage (CI)

`npm test` includes `tests/hardening.mjs`: ownership, late-cancel decision, webhook lease outcomes, payments gate.

## Exit

All rows checked. Then follow [PAID_LIVE_RUNBOOK.md](./PAID_LIVE_RUNBOOK.md).
