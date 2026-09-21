"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Artist } from "@/domain/model";
import { updateProfileSection, recordProfileAvatar, checkSlugAvailable } from "@/server/actions";
import { uploadAvatar } from "@/features/uploads";
import { artistToDraft, type ProfileDraft } from "@/features/onboarding/ProfilePreview";
import { profileCompletion } from "@/features/onboarding/completion";
import { BasicStep } from "@/features/onboarding/steps/BasicStep";
import { SoundStep } from "@/features/onboarding/steps/SoundStep";
import { MusicStep } from "@/features/onboarding/steps/MusicStep";
import { FeatSettingsStep } from "@/features/onboarding/steps/FeatSettingsStep";
import { AboutStep } from "@/features/onboarding/steps/AboutStep";
import { PROFILE_LANGUAGES } from "@/lib/profile-constants";

const SECTIONS = [
  { id: "profile", label: "profile" },
  { id: "sound", label: "sound" },
  { id: "music", label: "music" },
  { id: "feat", label: "feat settings" },
  { id: "socials", label: "socials" },
] as const;

type Section = (typeof SECTIONS)[number]["id"];

type Props = {
  me: Artist;
  demo: boolean;
  userId?: string | null;
  onDemoSave: (draft: ProfileDraft) => void;
  accountPanel?: React.ReactNode;
};

export function EditProfile({ me, demo, userId, onDemoSave, accountPanel }: Props) {
  const [section, setSection] = useState<Section>("profile");
  const [draft, setDraft] = useState<ProfileDraft>(() => artistToDraft(me));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugStatus, setSlugStatus] = useState("");
  const completion = profileCompletion({ ...me, ...draft, price: draft.priceCents });

  useEffect(() => {
    setDraft(artistToDraft(me));
  }, [me]);

  useEffect(() => {
    if (demo || !draft.slug) return;
    const t = setTimeout(() => {
      checkSlugAvailable(draft.slug)
        .then((r) => setSlugStatus(r.available ? "available" : "taken"))
        .catch(() => setSlugStatus(""));
    }, 400);
    return () => clearTimeout(t);
  }, [draft.slug, demo]);

  const patch = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }));

  async function onAvatarFile(file: File) {
    setUploading(true);
    try {
      if (demo) {
        patch({ avatarUrl: URL.createObjectURL(file) });
        toast.success("photo set");
        return;
      }
      if (!userId) throw new Error("Sign in again to upload.");
      const up = await uploadAvatar(userId, file);
      const res = await recordProfileAvatar(up);
      patch({ avatarUrl: res.url });
      toast.success("photo set");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      if (demo) {
        onDemoSave(draft);
        toast.success("saved");
        return;
      }
      if (section === "profile") {
        await updateProfileSection({
          section: "profile",
          data: {
            name: draft.name,
            slug: draft.slug,
            location: draft.location,
            artistTypes: draft.artistTypes,
          },
        });
      } else if (section === "sound") {
        await updateProfileSection({
          section: "sound",
          data: {
            genres: draft.genres,
            influences: draft.influences,
            language: draft.language,
          },
        });
      } else if (section === "music" || section === "socials") {
        await updateProfileSection({
          section,
          data: {
            spotifyUrl: draft.spotifyUrl,
            appleMusicUrl: draft.appleMusicUrl,
            soundcloudUrl: draft.soundcloudUrl,
            youtubeUrl: draft.youtubeUrl,
            instagramUrl: draft.instagramUrl,
            tiktokUrl: draft.tiktokUrl,
            featuredTrackUrl: draft.featuredTrackUrl,
          },
        });
      } else if (section === "feat") {
        await updateProfileSection({
          section: "feat",
          data: {
            featStatus: draft.featStatus,
            collaborationTypes: draft.collaborationTypes,
            pricingMode: draft.pricingMode,
            price: draft.priceCents / 100,
            currency: draft.currency,
          },
        });
      }
      toast.success("saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="edit-profile">
      <div className="page-heading">
        <div>
          <h1>your page</h1>
          <p>profile {completion.percentage}% complete</p>
        </div>
      </div>
      <div className="chip-row section-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${section === s.id ? "active" : ""}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="panel">
        {section === "profile" && (
          <BasicStep
            draft={draft}
            onChange={patch}
            slugStatus={slugStatus}
            onAvatarFile={onAvatarFile}
            uploading={uploading}
          />
        )}
        {section === "sound" && (
          <>
            <SoundStep draft={draft} onChange={patch} />
            <label className="field">
              language
              <select
                value={draft.language}
                onChange={(e) => patch({ language: e.target.value })}
              >
                {PROFILE_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {section === "music" && <MusicStep draft={draft} onChange={patch} />}
        {section === "feat" && <FeatSettingsStep draft={draft} onChange={patch} />}
        {section === "socials" && <MusicStep draft={draft} onChange={patch} />}
        <button type="button" className="btn primary" disabled={busy} onClick={save}>
          save
        </button>
      </div>
      {accountPanel}
    </div>
  );
}
