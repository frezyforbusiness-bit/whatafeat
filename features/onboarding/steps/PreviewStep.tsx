"use client";

import type { ProfileDraft } from "../ProfilePreview";
import { ProfilePreview } from "../ProfilePreview";

export function PreviewStep({ draft }: { draft: ProfileDraft }) {
  return (
    <div className="onboard-step">
      <div className="page-heading">
        <div>
          <h1>this you?</h1>
          <p>check the page before it goes live.</p>
        </div>
      </div>
      <ProfilePreview draft={draft} />
    </div>
  );
}
