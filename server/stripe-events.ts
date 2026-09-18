import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { stripeEvents } from "@/db/schema";
import { webhookClaimOutcome } from "@/lib/payment-decisions";

const LEASE_MS = 60_000;

/**
 * Claims a Stripe event for processing. status=completed is the only proof the
 * handler finished; a crash leaves processing until the lease expires.
 */
export async function claimStripeEvent(event: {
  id: string;
  type: string;
}): Promise<"claimed" | "duplicate"> {
  const db = getDb();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);

  const [existing] = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.id, event.id))
    .limit(1);

  const outcome = webhookClaimOutcome(
    existing
      ? { status: existing.status, leaseUntil: existing.leaseUntil }
      : null,
    now,
  );

  if (outcome === "duplicate") return "duplicate";

  if (outcome === "insert") {
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
    return inserted.length ? "claimed" : "duplicate";
  }

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

export async function completeStripeEvent(id: string) {
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

export async function failStripeEvent(id: string, message: string) {
  const db = getDb();
  await db
    .update(stripeEvents)
    .set({
      status: "failed",
      leaseUntil: new Date(0),
      lastError: message.slice(0, 2000),
    })
    .where(and(eq(stripeEvents.id, id), ne(stripeEvents.status, "completed")));
}
