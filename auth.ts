import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb, hasDatabase } from "@/db";
import {
  accounts,
  artistProfiles,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { eq } from "drizzle-orm";

const providers = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers,
  adapter: hasDatabase()
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  session: { strategy: hasDatabase() ? "database" : "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        if (hasDatabase()) {
          const db = getDb();
          const [profile] = await db
            .select()
            .from(artistProfiles)
            .where(eq(artistProfiles.userId, user.id))
            .limit(1);
          session.user.artistId = profile?.id;
          session.user.onboardingComplete = profile?.onboardingComplete ?? false;
          session.user.artistSlug = profile?.slug;
          session.user.artistName = profile?.name;
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!hasDatabase() || !user.id) return;
      const db = getDb();
      const base =
        (user.name || user.email?.split("@")[0] || "artist")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "artist";
      let slug = base;
      let n = 0;
      while (true) {
        const existing = await db
          .select({ id: artistProfiles.id })
          .from(artistProfiles)
          .where(eq(artistProfiles.slug, slug))
          .limit(1);
        if (!existing.length) break;
        n += 1;
        slug = `${base}-${n}`;
      }
      await db.insert(artistProfiles).values({
        userId: user.id,
        slug,
        name: user.name || "New artist",
        bio: "",
        onboardingComplete: false,
      });
    },
  },
});
