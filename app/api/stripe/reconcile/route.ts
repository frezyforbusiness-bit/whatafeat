import { NextResponse } from "next/server";
import { and, eq, gte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { collaborations } from "@/db/schema";
import { captureException } from "@/lib/monitoring";
import { drainSettlementQueue } from "@/server/payments";
import { stripeConfigured } from "@/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron / operator endpoint that retries pending escrow releases and refunds.
 * Vercel Cron sends Authorization: Bearer $CRON_SECRET when that env is set.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const drained = await drainSettlementQueue(50);
    await alertNearCap();
    return NextResponse.json({ drained });
  } catch (error) {
    await captureException(error, { tags: { area: "reconcile" } });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

async function alertNearCap() {
  const db = getDb();
  const stuck = await db
    .select({
      id: collaborations.id,
      attempts: collaborations.settlementAttempts,
      status: collaborations.settlementStatus,
    })
    .from(collaborations)
    .where(
      and(
        or(
          eq(collaborations.settlementStatus, "release_pending"),
          eq(collaborations.settlementStatus, "refund_pending"),
        ),
        gte(collaborations.settlementAttempts, 20),
      ),
    )
    .limit(10);

  for (const row of stuck) {
    await captureException(new Error("Settlement near attempt cap"), {
      tags: {
        area: "settlement",
        settlementStatus: row.status,
        collaborationId: row.id,
      },
      extra: { attempts: row.attempts },
    });
  }
}
