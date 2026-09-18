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
import { readPrivateAsset } from "@/server/blob";

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

  const authorised = await canRead(asset.ownerUserId, session.user.id, id);
  if (!authorised) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Private blobs are streamed through this route. We never expose the
  // underlying blob URL, so access cannot outlive this authorisation check.
  const file = await readPrivateAsset(asset.pathname);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.size),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        asset.pathname.split("/").pop() ?? "download",
      )}"`,
    },
  });
}

async function canRead(ownerUserId: string, viewerUserId: string, assetId: string) {
  if (ownerUserId === viewerUserId) return true;

  const db = getDb();
  const [profile] = await db
    .select()
    .from(artistProfiles)
    .where(eq(artistProfiles.userId, viewerUserId))
    .limit(1);
  if (!profile) return false;

  // Readable if the viewer participates in the collaboration this file belongs to
  const rows = await db
    .select({ artistId: collaborationParticipants.artistId })
    .from(deliveryFiles)
    .innerJoin(deliveries, eq(deliveryFiles.deliveryId, deliveries.id))
    .innerJoin(contributions, eq(deliveries.contributionId, contributions.id))
    .innerJoin(
      collaborationParticipants,
      eq(contributions.collaborationId, collaborationParticipants.collaborationId),
    )
    .where(eq(deliveryFiles.assetId, assetId));

  return rows.some((r) => r.artistId === profile.id);
}
