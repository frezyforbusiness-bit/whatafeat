import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { artistProfiles } from "@/db/schema";
import { captureException } from "@/lib/monitoring";
import {
  drainSettlementQueue,
  markCollaborationPaid,
} from "@/server/payments";
import {
  claimStripeEvent,
  completeStripeEvent,
  failStripeEvent,
} from "@/server/stripe-events";
import { getStripe } from "@/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const claim = await claimStripeEvent(event);
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
    await completeStripeEvent(event.id);
  } catch (error) {
    await failStripeEvent(event.id, (error as Error).message);
    await captureException(error, {
      tags: { area: "stripe_webhook", eventType: event.type },
      extra: { eventId: event.id },
    });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  try {
    await drainSettlementQueue();
  } catch (error) {
    await captureException(error, { tags: { area: "settlement_drain" } });
  }

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (
        event.type === "checkout.session.completed" &&
        session.payment_status !== "paid"
      ) {
        return;
      }
      const collaborationId = session.client_reference_id ?? session.metadata?.collaborationId;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      if (!collaborationId || !paymentIntentId) return;
      await markCollaborationPaid({ collaborationId, paymentIntentId });
      return;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.warn(
        "Async payment failed",
        session.client_reference_id ?? session.metadata?.collaborationId,
      );
      return;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const enabled = Boolean(account.charges_enabled && account.payouts_enabled);
      const db = getDb();
      await db
        .update(artistProfiles)
        .set({ stripePayoutsEnabled: enabled, updatedAt: new Date() })
        .where(eq(artistProfiles.stripeAccountId, account.id));
      return;
    }

    default:
      return;
  }
}
