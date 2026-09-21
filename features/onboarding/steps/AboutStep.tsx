"use client";

import type { ProfileDraft } from "../ProfilePreview";

export function AboutStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  return (
    <div className="onboard-step">
      <div className="page-heading">
        <div>
          <h1>say something about yourself</h1>
          <p>short bio for the cards. keep it real.</p>
        </div>
      </div>
      <label className="field">
        short bio
        <textarea
          value={draft.bio}
          onChange={(e) => onChange({ bio: e.target.value.slice(0, 160) })}
          rows={3}
          maxLength={160}
          placeholder="melodic trap artist out of paris"
        />
        <span className="fine">{draft.bio.length}/160</span>
      </label>
      <label className="field">
        longer description
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={5}
          maxLength={4000}
          placeholder="optional. the deeper cut."
        />
      </label>
    </div>
  );
}
