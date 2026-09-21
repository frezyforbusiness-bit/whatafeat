import type { Artist } from "@/domain/model";

export type CompletionResult = {
  percentage: number;
  missing: string[];
};

/** Computed profile completeness — not persisted. Language does not count. */
export function profileCompletion(a: Partial<Artist> | null | undefined): CompletionResult {
  if (!a) return { percentage: 0, missing: ["artist name", "username", "artist type"] };

  const checks: { key: string; ok: boolean }[] = [
    { key: "profile picture", ok: !!a.avatarUrl },
    { key: "bio", ok: !!(a.bio && a.bio.trim()) },
    { key: "genres", ok: !!(a.genres && a.genres.length) },
    {
      key: "music link",
      ok: !!(
        a.demo ||
        a.featuredTrackUrl ||
        a.spotifyUrl ||
        a.appleMusicUrl ||
        a.soundcloudUrl ||
        a.youtubeUrl
      ),
    },
    {
      key: "feat settings",
      ok: !!(a.featStatus && (a.collaborationTypes?.length || a.featStatus === "closed")),
    },
    {
      key: "social link",
      ok: !!(a.instagramUrl || a.tiktokUrl || a.spotifyUrl || a.youtubeUrl || a.soundcloudUrl),
    },
  ];

  const missing = checks.filter((c) => !c.ok).map((c) => c.key);
  const done = checks.length - missing.length;
  const percentage = Math.round((done / checks.length) * 100);
  return { percentage, missing };
}

export function hasCoreIdentity(a: Partial<Artist> | null | undefined) {
  return !!(a?.name?.trim() && a?.slug?.trim() && a?.artistTypes && a.artistTypes.length >= 1);
}
