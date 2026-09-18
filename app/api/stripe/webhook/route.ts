import { NextResponse } from "next/server";
import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { artistProfiles, stripeEvents } from "@/db/schema";
import {
  drainSettlementQueue,
  markCollaborationPaid,
} from "@/server/payments";
import { getStripe } from "@/server/stripe";

// Signature verification needs the exact bytes Stripe signed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEASE_MS = 60_000;

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
    // Never trust an unverified body: this is the only thing standing between
    // the public internet and "mark this collaboration paid".
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const claim = await claimEvent(event);
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
    await completeEvent(event.id);
  } catch (error) {
    // Release the lease so Stripe's retry (or a reconcile pass) can reclaim.
    await failEvent(event.id, (error as Error).message);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  // Opportunistic drain of pending transfers/refunds after any successful event.
  try {
    await drainSettlementQueue();
  } catch (error) {
    console.error("Settlement drain failed", error);
  }

  return NextResponse.json({ received: true });
}

/**
 * Claims an event for processing. Existence of the row is NOT success —
 * only status=completed is. A crash between claim and complete leaves
 * status=processing; once the lease expires a retry reclaims the same id.
 */
async function claimEvent(event: Stripe.Event): Promise<"claimed" | "duplicate"> {
  const db = getDb();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);

  const inserted = await db
    .insert(stripeEvents)
    .values({
      id: event.id,
      type: event.type,
      status: "processing",
      receivedAt: now,
      leaseUntil,
      attempts: 1,
    })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  if (inserted.length) return "claimed";

  const reclaimed = await db
    .update(stripeEvents)
    .set({
      status: "processing",
      leaseUntil,
      attempts: sql`${stripeEvents.attempts} + 1`,
      lastError: null,
    })
    .where(
      and(
        eq(stripeEvents.id, event.id),
        ne(stripeEvents.status, "completed"),
        or(sql`${stripeEvents.leaseUntil} is null`, lt(stripeEvents.leaseUntil, now)),
      ),
    )
    .returning({ id: stripeEvents.id });

  return reclaimed.length ? "claimed" : "duplicate";
}

async function completeEvent(id: string) {
  const db = getDb();
  await db
    .update(stripeEvents)
    .set({
      status: "completed",
      completedAt: new Date(),
      leaseUntil: null,
      lastError: null,
    })
    .where(eq(stripeEvents.id, id));
}

async function failEvent(id: string, message: string) {
  const db = getDb();
  await db
    .update(stripeEvents)
    .set({
      status: "failed",
      // Expired lease so the next Stripe delivery can reclaim immediately.
      leaseUntil: new Date(0),
      lastError: message.slice(0, 2000),
    })
    .where(and(eq(stripeEvents.id, id), ne(stripeEvents.status, "completed")));
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      // async_payment_succeeded is always paid; completed may still be unpaid
      // for delayed methods — ignore those until the async success event.
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
      // Card-only Checkout should not emit this; log for operator visibility.
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
