"use client";

import { useState } from "react";
import type { ProfileDraft } from "../ProfilePreview";
import { PROFILE_GENRES } from "@/lib/profile-constants";

export function SoundStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  const [custom, setCustom] = useState("");
  const [influence, setInfluence] = useState("");

  const toggleGenre = (g: string) => {
    const has = draft.genres.includes(g);
    onChange({ genres: has ? draft.genres.filter((x) => x !== g) : [...draft.genres, g] });
  };

  const addCustom = () => {
    const g = custom.trim().toLowerCase();
    if (!g || draft.genres.includes(g)) return;
    onChange({ genres: [...draft.genres, g] });
    setCustom("");
  };

  const addInfluence = () => {
    const v = influence.trim();
    if (!v || draft.influences.includes(v)) return;
    onChange({ influences: [...draft.influences, v] });
    setInfluence("");
  };

  return (
    <div className="onboard-step">
      <div className="page-heading">
        <div>
          <h1>what do you sound like?</h1>
          <p>pick your lane — or a few.</p>
        </div>
      </div>
      <div className="field">
        <span>genres</span>
        <div className="chip-row">
          {PROFILE_GENRES.map((g) => (
            <button
              key={g}
              type="button"
              className={`chip ${draft.genres.includes(g) ? "active" : ""}`}
              onClick={() => toggleGenre(g)}
            >
              {g}
            </button>
          ))}
          {draft.genres
            .filter((g) => !(PROFILE_GENRES as readonly string[]).includes(g))
            .map((g) => (
              <button key={g} type="button" className="chip active" onClick={() => toggleGenre(g)}>
                {g}
              </button>
            ))}
        </div>
        <div className="inline-actions">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="custom genre / tag"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          />
          <button type="button" className="btn" onClick={addCustom}>
            add
          </button>
        </div>
      </div>
      <div className="field">
        <span>artists that inspire you</span>
        <div className="chip-row">
          {draft.influences.map((i) => (
            <button
              key={i}
              type="button"
              className="chip active"
              onClick={() => onChange({ influences: draft.influences.filter((x) => x !== i) })}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="inline-actions">
          <input
            value={influence}
            onChange={(e) => setInfluence(e.target.value)}
            placeholder="Playboi Carti"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInfluence())}
          />
          <button type="button" className="btn" onClick={addInfluence}>
            add
          </button>
        </div>
      </div>
    </div>
  );
}
