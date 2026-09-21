"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Artist, Store } from "@/domain/model";
import {
  checkSlugAvailable,
  finalizeOnboarding,
  recordProfileAvatar,
  saveProfileDraft,
} from "@/server/actions";
import { uploadAvatar } from "@/features/uploads";
import { artistToDraft, type ProfileDraft } from "./ProfilePreview";
import { BasicStep } from "./steps/BasicStep";
import { SoundStep } from "./steps/SoundStep";
import { MusicStep } from "./steps/MusicStep";
import { FeatSettingsStep } from "./steps/FeatSettingsStep";
import { AboutStep } from "./steps/AboutStep";
import { PreviewStep } from "./steps/PreviewStep";
import { DemoAudioField } from "@/features/edit-profile/DemoAudioField";

const STEPS = ["basic", "sound", "music", "feats", "about", "preview"] as const;

type Props = {
  me: Artist | undefined;
  demo: boolean;
  account: string | null;
  userId?: string | null;
  onDemoSave: (draft: ProfileDraft, finalize: boolean) => void;
  onComplete: () => void;
};

export function OnboardingWizard({ me, demo, account, userId, onDemoSave, onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(() => artistToDraft(me));
  const [hasDemo, setHasDemo] = useState(!!me?.demo);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugStatus, setSlugStatus] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDraft(artistToDraft(me));
    setHasDemo(!!me?.demo);
  }, [me?.id, me?.slug, me?.name, me?.demo]);

  useEffect(() => {
    if (!draft.slug || draft.slug.length < 2) {
      setSlugStatus("");
      return;
    }
    if (demo) {
      setSlugStatus("looks good");
      return;
    }
    const t = setTimeout(() => {
      checkSlugAvailable(draft.slug)
        .then((r) => setSlugStatus(r.available ? "available" : "taken"))
        .catch(() => setSlugStatus(""));
    }, 400);
    return () => clearTimeout(t);
  }, [draft.slug, demo]);

  const patch = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }));

  const draftPayload = useMemo(
    () => ({
      name: draft.name || undefined,
      slug: draft.slug || undefined,
      location: draft.location,
      artistTypes: draft.artistTypes,
      genres: draft.genres,
      influences: draft.influences,
      bio: draft.bio,
      description: draft.description,
      spotifyUrl: draft.spotifyUrl,
      appleMusicUrl: draft.appleMusicUrl,
      soundcloudUrl: draft.soundcloudUrl,
      youtubeUrl: draft.youtubeUrl,
      instagramUrl: draft.instagramUrl,
      tiktokUrl: draft.tiktokUrl,
      featuredTrackUrl: draft.featuredTrackUrl,
      featStatus: draft.featStatus,
      collaborationTypes: draft.collaborationTypes,
      pricingMode: draft.pricingMode,
      price: draft.priceCents / 100,
      currency: draft.currency as "EUR" | "USD" | "GBP",
    }),
    [draft],
  );

  async function persistDraft() {
    if (demo) {
      onDemoSave({ ...draft, demo: hasDemo }, false);
      return;
    }
    await saveProfileDraft(draftPayload);
  }

  async function onAvatarFile(file: File) {
    setUploading(true);
    try {
      if (demo) {
        const url = URL.createObjectURL(file);
        patch({ avatarUrl: url });
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

  function validateStep(): string | null {
    if (step === 0) {
      if (!draft.name.trim()) return "add your artist name.";
      if (!draft.slug.trim()) return "pick a username.";
      if (!draft.artistTypes.length) return "pick at least one artist type.";
      if (!demo && slugStatus === "taken") return "that username is taken.";
    }
    return null;
  }

  async function goNext(skip = false) {
    if (!skip) {
      const err = validateStep();
      if (err) {
        toast.error(err);
        return;
      }
    }
    setBusy(true);
    try {
      await persistDraft();
      if (step < STEPS.length - 1) setStep((s) => s + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    const err = validateStep();
    if (!draft.name.trim() || !draft.slug.trim() || !draft.artistTypes.length) {
      toast.error(err || "name, username and artist type are required.");
      setStep(0);
      return;
    }
    setBusy(true);
    try {
      if (demo) {
        onDemoSave({ ...draft, demo: hasDemo }, true);
      } else {
        await persistDraft();
        await finalizeOnboarding({
          name: draft.name,
          slug: draft.slug,
          artistTypes: draft.artistTypes,
        });
      }
      setDone(true);
      onComplete();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="onboard-step">
        <div className="page-heading">
          <div>
            <h1>you&apos;re in.</h1>
            <p>your page is live. go find a feat.</p>
          </div>
        </div>
        <div className="intro-actions">
          <Link className="btn primary" href="/explore">
            find artists
          </Link>
          <Link className="btn" href={`/artists/${draft.slug}`}>
            view my page
          </Link>
        </div>
      </div>
    );
  }

  const optional = step >= 1 && step <= 4;

  return (
    <div className="onboarding-wizard">
      <div className="onboard-progress" aria-label="progress">
        {STEPS.map((s, i) => (
          <span key={s} className={i === step ? "active" : i < step ? "done" : ""}>
            {i + 1}
          </span>
        ))}
      </div>
      {step === 0 && (
        <BasicStep
          draft={draft}
          onChange={patch}
          slugStatus={slugStatus}
          onAvatarFile={onAvatarFile}
          uploading={uploading}
        />
      )}
      {step === 1 && <SoundStep draft={draft} onChange={patch} />}
      {step === 2 && <><MusicStep draft={draft} onChange={patch} /><div className="panel"><DemoAudioField demo={demo} userId={userId} hasDemo={hasDemo} onDemoFlag={(v)=>{setHasDemo(v);patch({demo:v});}}/></div></>}
      {step === 3 && <FeatSettingsStep draft={draft} onChange={patch} />}
      {step === 4 && <AboutStep draft={draft} onChange={patch} />}
      {step === 5 && <PreviewStep draft={draft} />}

      <div className="onboard-nav">
        {step > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={() => setStep((s) => s - 1)}>
            back
          </button>
        )}
        {optional && (
          <button type="button" className="text-btn" disabled={busy} onClick={() => goNext(true)}>
            skip
          </button>
        )}
        {step < 5 ? (
          <button type="button" className="btn primary" disabled={busy} onClick={() => goNext(false)}>
            continue
          </button>
        ) : (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => setStep(0)}>
              edit it
            </button>
            <button type="button" className="btn primary" disabled={busy} onClick={finish}>
              looks good
            </button>
          </>
        )}
      </div>
      {!account && !demo ? (
        <p className="fine">sign in to save your page.</p>
      ) : null}
      {step === 5 ? null : (
        <button type="button" className="text-btn" onClick={() => router.push("/")}>
          dig in first
        </button>
      )}
    </div>
  );
}

/** Apply a draft onto the local demo store artist. */
export function applyDraftToArtist(a: Artist, draft: ProfileDraft, finalize: boolean): Artist {
  return {
    ...a,
    name: draft.name || a.name,
    slug: draft.slug || a.slug,
    location: draft.location,
    artistTypes: draft.artistTypes,
    genres: draft.genres,
    genre: draft.genres[0] || a.genre,
    influences: draft.influences,
    language: a.language,
    bio: draft.bio,
    description: draft.description,
    spotifyUrl: draft.spotifyUrl,
    appleMusicUrl: draft.appleMusicUrl,
    soundcloudUrl: draft.soundcloudUrl,
    youtubeUrl: draft.youtubeUrl,
    instagramUrl: draft.instagramUrl,
    tiktokUrl: draft.tiktokUrl,
    featuredTrackUrl: draft.featuredTrackUrl,
    featStatus: draft.featStatus,
    collaborationTypes: draft.collaborationTypes,
    pricingMode: draft.pricingMode,
    price: draft.priceCents,
    currency: draft.currency,
    trade: draft.featStatus !== "closed" && draft.collaborationTypes.includes("swap"),
    avatarUrl: draft.avatarUrl ?? a.avatarUrl,
    demo: draft.demo ?? a.demo,
    onboardingComplete: finalize ? true : a.onboardingComplete,
  };
}

export function ensureDemoArtist(store: Store, account: string | null): string {
  if (account && store.artists.some((a) => a.id === account)) return account;
  return account || store.artists[0]?.id || "";
}
