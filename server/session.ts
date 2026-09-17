import { auth } from "@/auth";
import { getDb } from "@/db";
import { artistProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required.");
  return session;
}

export async function requireArtist() {
  const session = await requireSession();
  const db = getDb();
  const [profile] = await db
    .select()
    .from(artistProfiles)
    .where(eq(artistProfiles.userId, session.user.id))
    .limit(1);
  if (!profile) throw new Error("Artist profile missing. Complete onboarding.");
  return { session, profile };
}

export async function requireOnboardedArtist() {
  const ctx = await requireArtist();
  if (!ctx.profile.onboardingComplete) {
    throw new Error("Finish onboarding before using the studio.");
  }
  return ctx;
}
