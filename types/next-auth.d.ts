import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      artistId?: string;
      artistSlug?: string;
      artistName?: string;
      onboardingComplete?: boolean;
    };
  }
}
