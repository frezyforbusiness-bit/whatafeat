import { NextResponse } from "next/server";
import { drainSettlementQueue } from "@/server/payments";
import { stripeConfigured } from "@/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron / operator endpoint that retries pending escrow releases and refunds.
 * Protect with CRON_SECRET (Authorization: Bearer …) when exposed publicly.
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

  const drained = await drainSettlementQueue(50);
  return NextResponse.json({ drained });
}

export async function GET(request: Request) {
  return POST(request);
}
