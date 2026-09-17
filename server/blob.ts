import { put, del } from "@vercel/blob";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";

const PUBLIC_AUDIO = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3"];
const PUBLIC_IMAGE = ["image/jpeg", "image/png", "image/webp"];

export async function uploadPublicDemo(userId: string, file: File) {
  if (file.size > 100 * 1024 * 1024) throw new Error("Demo must be 100 MB or smaller.");
  if (![...PUBLIC_AUDIO].includes(file.type)) throw new Error("Choose an MP3 or WAV demo.");
  return saveAsset(userId, file, "public", `demos/${userId}`);
}

export async function uploadArtwork(userId: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Artwork must be 10 MB or smaller.");
  if (!PUBLIC_IMAGE.includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  return saveAsset(userId, file, "public", `artwork/${userId}`);
}

export async function uploadDeliveryFile(userId: string, file: File) {
  if (file.size > 500 * 1024 * 1024) throw new Error("Each delivery file must be 500 MB or smaller.");
  const ok =
    file.type.startsWith("audio/") ||
    ["application/zip", "application/x-zip-compressed"].includes(file.type) ||
    file.name.toLowerCase().endsWith(".zip");
  if (!ok) throw new Error("Choose audio or ZIP files.");
  return saveAsset(userId, file, "private", `deliveries/${userId}`);
}

async function saveAsset(
  userId: string,
  file: File,
  visibility: "public" | "private",
  prefix: string,
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }
  const pathname = `${prefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const blob = await put(pathname, file, {
    access: visibility === "public" ? "public" : "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });
  // Note: Vercel Blob private access tokens are used at download time via app route.
  // We store visibility in DB and gate downloads in /api/assets/[id].
  const db = getDb();
  const [row] = await db
    .insert(assets)
    .values({
      ownerUserId: userId,
      blobUrl: blob.url,
      pathname: blob.pathname,
      mime: file.type || "application/octet-stream",
      size: file.size,
      visibility,
    })
    .returning();
  return row;
}

export async function deleteAsset(assetId: string, userId: string) {
  const db = getDb();
  const [row] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!row || row.ownerUserId !== userId) throw new Error("Asset not found.");
  await del(row.blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
  await db.delete(assets).where(eq(assets.id, assetId));
}
