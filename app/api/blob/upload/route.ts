import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { artistProfiles } from "@/db/schema";
import {
  DELIVERY_CONTENT_TYPES,
  DELIVERY_MAX_BYTES,
  DEMO_MAX_BYTES,
} from "@/server/blob";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";

const DEMO_CONTENT_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3"];

/**
 * Issues short-lived client upload tokens so large files go straight to Blob
 * instead of through a Server Action, which caps request bodies at 1 MB.
 *
 * The token is scoped: it fixes the destination prefix to the caller's own
 * namespace and constrains content type and maximum size per upload kind.
 */
export async function POST(request: Request) {
  try {
    await assertRateLimit("upload", `ip:${clientIp(request)}`);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 429 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user?.id) throw new Error("Sign in to upload.");

        const db = getDb();
        const [profile] = await db
          .select()
          .from(artistProfiles)
          .where(eq(artistProfiles.userId, session.user.id))
          .limit(1);
        if (!profile?.onboardingComplete) throw new Error("Complete your profile first.");

        const kind = parseKind(clientPayload);
        const expectedPrefix =
          kind === "demo" ? `demos/${session.user.id}/` : `deliveries/${session.user.id}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload destination.");
        }

        await assertRateLimit("upload", `user:${session.user.id}`);

        return {
          allowedContentTypes:
            kind === "demo" ? DEMO_CONTENT_TYPES : DELIVERY_CONTENT_TYPES,
          maximumSizeInBytes: kind === "demo" ? DEMO_MAX_BYTES : DELIVERY_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, kind }),
        };
      },
      onUploadCompleted: async () => {
        // Asset rows are written by the server action that follows the upload,
        // so nothing to do here. This callback does not fire on localhost.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

function parseKind(clientPayload: string | null): "demo" | "delivery" {
  if (!clientPayload) throw new Error("Missing upload kind.");
  try {
    const parsed = JSON.parse(clientPayload) as { kind?: string };
    if (parsed.kind === "demo" || parsed.kind === "delivery") return parsed.kind;
  } catch {
    // fall through
  }
  throw new Error("Unknown upload kind.");
}
