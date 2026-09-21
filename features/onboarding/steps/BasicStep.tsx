"use client";

import type { ProfileDraft } from "../ProfilePreview";
import { ARTIST_TYPES } from "@/lib/profile-constants";

export function BasicStep({
  draft,
  onChange,
  slugStatus,
  onAvatarFile,
  uploading,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
  slugStatus: string;
  onAvatarFile: (file: File) => void;
  uploading?: boolean;
}) {
  const toggleType = (t: string) => {
    const has = draft.artistTypes.includes(t);
    onChange({
      artistTypes: has ? draft.artistTypes.filter((x) => x !== t) : [...draft.artistTypes, t],
    });
  };

  return (
    <div className="onboard-step">
      <div className="page-heading">
        <div>
          <h1>let&apos;s build your page</h1>
          <p>this is how artists will see you.</p>
        </div>
      </div>
      <label className="field">
        profile picture
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAvatarFile(f);
          }}
        />
        {uploading ? <span className="fine">uploading…</span> : null}
        {draft.avatarUrl ? <span className="fine">photo set.</span> : null}
      </label>
      <label className="field">
        artist name *
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
          maxLength={80}
          placeholder="your artist name"
        />
      </label>
      <label className="field">
        username *
        <input
          value={draft.slug}
          onChange={(e) =>
            onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
          }
          required
          maxLength={60}
          placeholder="username"
        />
        <span className="fine">whatafeat.com/@{draft.slug || "username"}</span>
        {slugStatus ? <span className="fine">{slugStatus}</span> : null}
      </label>
      <label className="field">
        location
        <input
          value={draft.location}
          onChange={(e) => onChange({ location: e.target.value })}
          maxLength={120}
          placeholder="paris, milan, wherever"
        />
      </label>
      <div className="field">
        <span>artist type *</span>
        <div className="chip-row">
          {ARTIST_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${draft.artistTypes.includes(t) ? "active" : ""}`}
              onClick={() => toggleType(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="fine">pick as many as fit — rapper + producer is fine.</p>
      </div>
    </div>
  );
}
