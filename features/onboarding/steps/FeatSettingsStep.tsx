"use client";

import type { ProfileDraft } from "../ProfilePreview";
import {
  COLLAB_TYPE_OPTIONS,
  CURRENCIES,
  FEAT_STATUS_OPTIONS,
  PRICING_MODE_OPTIONS,
} from "@/lib/profile-constants";

export function FeatSettingsStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  const paid = draft.collaborationTypes.includes("paid");
  const showPrice = paid && draft.pricingMode !== "offer";

  const toggleCollab = (v: string) => {
    const has = draft.collaborationTypes.includes(v);
    onChange({
      collaborationTypes: has
        ? draft.collaborationTypes.filter((x) => x !== v)
        : [...draft.collaborationTypes, v],
    });
  };

  return (
    <div className="onboard-step">
      <div className="page-heading">
        <div>
          <h1>how do you wanna work?</h1>
          <p>feat settings — keep it honest.</p>
        </div>
      </div>
      <div className="field">
        <span>feat status</span>
        <div className="chip-row">
          {FEAT_STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`chip ${draft.featStatus === o.value ? "active" : ""}`}
              onClick={() => onChange({ featStatus: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {draft.featStatus !== "closed" && (
        <div className="field">
          <span>collab type</span>
          <div className="chip-row">
            {COLLAB_TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`chip ${draft.collaborationTypes.includes(o.value) ? "active" : ""}`}
                onClick={() => toggleCollab(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {paid && draft.featStatus !== "closed" && (
        <>
          <div className="field">
            <span>pricing</span>
            <div className="chip-row">
              {PRICING_MODE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`chip ${draft.pricingMode === o.value ? "active" : ""}`}
                  onClick={() => onChange({ pricingMode: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {showPrice && (
            <div className="form-grid">
              <label className="field">
                amount
                <input
                  type="number"
                  min={1}
                  value={Math.round(draft.priceCents / 100) || ""}
                  onChange={(e) =>
                    onChange({ priceCents: Math.round(Number(e.target.value || 0) * 100) })
                  }
                />
              </label>
              <label className="field">
                currency
                <select
                  value={draft.currency}
                  onChange={(e) => onChange({ currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
