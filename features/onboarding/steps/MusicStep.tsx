"use client";

import type { ProfileDraft } from "../ProfilePreview";
import { detectMusicPlatform, platformFieldKey } from "@/lib/detect-music-url";

const FIELDS: { key: keyof ProfileDraft; label: string }[] = [
  { key: "spotifyUrl", label: "Spotify" },
  { key: "appleMusicUrl", label: "Apple Music" },
  { key: "soundcloudUrl", label: "SoundCloud" },
  { key: "youtubeUrl", label: "YouTube" },
  { key: "instagramUrl", label: "Instagram" },
  { key: "tiktokUrl", label: "TikTok" },
];

export function MusicStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  const onPasteUrl = (raw: string) => {
    const platform = detectMusicPlatform(raw);
    const field = platformFieldKey(platform);
    if (field) onChange({ [field]: raw.trim() });
  };

  return (
    <div className="onboard-step">
      <div className="page-heading">
        <div>
          <h1>let them hear you</h1>
          <p>drop links. none of these are required.</p>
        </div>
      </div>
      {FIELDS.map(({ key, label }) => (
        <label className="field" key={key}>
          {label}
          <input
            value={String(draft[key] ?? "")}
            onChange={(e) => onChange({ [key]: e.target.value })}
            onBlur={(e) => {
              if (e.target.value) onPasteUrl(e.target.value);
            }}
            placeholder={`${label} url`}
          />
        </label>
      ))}
      <label className="field">
        drop your best track
        <input
          value={draft.featuredTrackUrl}
          onChange={(e) => onChange({ featuredTrackUrl: e.target.value })}
          placeholder="link to your strongest track"
        />
        <span className="fine">first impressions matter.</span>
      </label>
    </div>
  );
}
