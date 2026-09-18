import { put, del, get } from "@vercel/blob";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";

const PUBLIC_AUDIO = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3"];
const PUBLIC_IMAGE = ["image/jpeg", "image/png", "image/webp"];

export const DEMO_MAX_BYTES = 100 * 1024 * 1024;
export const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;
export const DELIVERY_MAX_BYTES = 500 * 1024 * 1024;

export const DELIVERY_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp3",
  "audio/aiff",
  "audio/flac",
  "application/zip",
  "application/x-zip-compressed",
];

export function assertDemoFile(type: string, size: number) {
  if (size > DEMO_MAX_BYTES) throw new Error("Demo must be 100 MB or smaller.");
  if (!PUBLIC_AUDIO.includes(type)) throw new Error("Choose an MP3 or WAV demo.");
}

export function assertDeliveryFile(name: string, type: string, size: number) {
  if (size > DELIVERY_MAX_BYTES) throw new Error("Each delivery file must be 500 MB or smaller.");
  const ok =
    type.startsWith("audio/") ||
    ["application/zip", "application/x-zip-compressed"].includes(type) ||
    name.toLowerCase().endsWith(".zip");
  if (!ok) throw new Error("Choose audio or ZIP files.");
}

export async function uploadPublicDemo(userId: string, file: File) {
  assertDemoFile(file.type, file.size);
  return saveAsset(userId, file, "public", `demos/${userId}`);
}

export async function uploadArtwork(userId: string, file: File) {
  if (file.size > ARTWORK_MAX_BYTES) throw new Error("Artwork must be 10 MB or smaller.");
  if (!PUBLIC_IMAGE.includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  return saveAsset(userId, file, "public", `artwork/${userId}`);
}

export async function uploadDeliveryFile(userId: string, file: File) {
  assertDeliveryFile(file.name, file.type, file.size);
  return saveAsset(userId, file, "private", `deliveries/${userId}`);
}

function token() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }
  return process.env.BLOB_READ_WRITE_TOKEN;
}

async function saveAsset(
  userId: string,
  file: File,
  visibility: "public" | "private",
  prefix: string,
) {
  const pathname = `${prefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const blob = await put(pathname, file, {
    access: visibility,
    token: token(),
    addRandomSuffix: true,
  });
  return recordAsset({
    userId,
    blobUrl: blob.url,
    pathname: blob.pathname,
    mime: file.type || "application/octet-stream",
    size: file.size,
    visibility,
  });
}

/**
 * Persists asset metadata. Used both by server-side uploads and by the client
 * upload flow, where the bytes go straight to Blob and only metadata comes back.
 */
export async function recordAsset(input: {
  userId: string;
  blobUrl: string;
  pathname: string;
  mime: string;
  size: number;
  visibility: "public" | "private";
}) {
  const db = getDb();
  const [row] = await db
    .insert(assets)
    .values({
      ownerUserId: input.userId,
      blobUrl: input.blobUrl,
      pathname: input.pathname,
      mime: input.mime,
      size: input.size,
      visibility: input.visibility,
    })
    .returning();
  return row;
}

/**
 * Streams a private blob's bytes. The caller must have already authorised the
 * viewer: private blob URLs are never handed to the browser, so this is the only
 * way the content can be read.
 */
export async function readPrivateAsset(pathname: string) {
  return get(pathname, { access: "private", token: token() });
}

export async function deleteAsset(assetId: string, userId: string) {
  const db = getDb();
  const [row] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!row || row.ownerUserId !== userId) throw new Error("Asset not found.");
  await del(row.blobUrl, { token: token() });
  await db.delete(assets).where(eq(assets.id, assetId));
}
