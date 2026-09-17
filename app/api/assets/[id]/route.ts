import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  assets,
  collaborationParticipants,
  contributions,
  deliveries,
  deliveryFiles,
  artistProfiles,
} from "@/db/schema";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = getDb();
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (asset.visibility === "public") {
    return NextResponse.redirect(asset.blobUrl);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile] = await db
    .select()
    .from(artistProfiles)
    .where(eq(artistProfiles.userId, session.user.id))
    .limit(1);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (asset.ownerUserId === session.user.id) {
    return NextResponse.redirect(asset.blobUrl);
  }

  // Participant in a collaboration that references this delivery file
  const rows = await db
    .select({ artistId: collaborationParticipants.artistId })
    .from(deliveryFiles)
    .innerJoin(deliveries, eq(deliveryFiles.deliveryId, deliveries.id))
    .innerJoin(contributions, eq(deliveries.contributionId, contributions.id))
    .innerJoin(
      collaborationParticipants,
      eq(contributions.collaborationId, collaborationParticipants.collaborationId),
    )
    .where(eq(deliveryFiles.assetId, id));

  if (!rows.some((r) => r.artistId === profile.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.redirect(asset.blobUrl);
}
