import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { artistProfiles, stripeEvents } from "@/db/schema";
import { markCollaborationPaid } from "@/server/payments";
import { getStripe } from "@/server/stripe";

// Signature verification needs the exact bytes Stripe signed.
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
    // Never trust an unverified body: this is the only thing standing between
    // the public internet and "mark this collaboration paid".
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  // Stripe retries until it gets a 2xx, so every event is claimed exactly once.
  const db = getDb();
  const claimed = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  if (!claimed.length) return NextResponse.json({ received: true, duplicate: true });

  try {
    await handle(event);
  } catch (error) {
    // Release the claim so Stripe's retry can have another go.
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id));
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return;
      const collaborationId = session.client_reference_id ?? session.metadata?.collaborationId;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      if (!collaborationId || !paymentIntentId) return;
      await markCollaborationPaid({ collaborationId, paymentIntentId });
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
