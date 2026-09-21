export type MusicPlatform =
  | "spotify"
  | "appleMusic"
  | "soundcloud"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "unknown";

const RULES: { platform: MusicPlatform; test: (host: string, href: string) => boolean }[] = [
  { platform: "spotify", test: (h) => h.includes("spotify.com") || h === "spoti.fi" },
  {
    platform: "appleMusic",
    test: (h) => h.includes("music.apple.com") || h.includes("itunes.apple.com"),
  },
  { platform: "soundcloud", test: (h) => h.includes("soundcloud.com") || h === "on.soundcloud.com" },
  {
    platform: "youtube",
    test: (h) =>
      h.includes("youtube.com") || h === "youtu.be" || h.includes("music.youtube.com"),
  },
  { platform: "instagram", test: (h) => h.includes("instagram.com") },
  { platform: "tiktok", test: (h) => h.includes("tiktok.com") || h === "vm.tiktok.com" },
];

/** Best-effort platform detection from a pasted URL. */
export function detectMusicPlatform(raw: string): MusicPlatform {
  const trimmed = raw.trim();
  if (!trimmed) return "unknown";
  try {
    const href = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    for (const rule of RULES) {
      if (rule.test(host, href)) return rule.platform;
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function platformFieldKey(
  platform: MusicPlatform,
):
  | "spotifyUrl"
  | "appleMusicUrl"
  | "soundcloudUrl"
  | "youtubeUrl"
  | "instagramUrl"
  | "tiktokUrl"
  | null {
  switch (platform) {
    case "spotify":
      return "spotifyUrl";
    case "appleMusic":
      return "appleMusicUrl";
    case "soundcloud":
      return "soundcloudUrl";
    case "youtube":
      return "youtubeUrl";
    case "instagram":
      return "instagramUrl";
    case "tiktok":
      return "tiktokUrl";
    default:
      return null;
  }
}
