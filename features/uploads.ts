'use client';
import { upload } from '@vercel/blob/client';

export type UploadedFile = { pathname: string; url: string; name: string };

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

type UploadKind = 'demo' | 'delivery' | 'artwork';

/**
 * Sends a file straight to Vercel Blob using a short-lived token from
 * /api/blob/upload. Server Actions cap request bodies at 1 MB, so audio and
 * ZIP deliveries cannot travel through them.
 *
 * The destination prefix is re-checked server-side against the signed-in user.
 */
async function put(kind: UploadKind, userId: string, file: File): Promise<UploadedFile> {
  const prefix = kind === 'demo' ? 'demos' : kind === 'artwork' ? 'artwork' : 'deliveries';
  const blob = await upload(`${prefix}/${userId}/${safeName(file.name)}`, file, {
    access: kind === 'delivery' ? 'private' : 'public',
    handleUploadUrl: '/api/blob/upload',
    clientPayload: JSON.stringify({ kind }),
    multipart: file.size > 8 * 1024 * 1024,
  });
  return { pathname: blob.pathname, url: blob.url, name: file.name };
}

export const uploadDemo = (userId: string, file: File) => put('demo', userId, file);

export const uploadAvatar = (userId: string, file: File) => put('artwork', userId, file);

export const uploadDeliveries = (userId: string, files: File[]) =>
  Promise.all(files.map((f) => put('delivery', userId, f)));
