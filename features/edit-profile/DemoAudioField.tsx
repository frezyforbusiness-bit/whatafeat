"use client";

import { useState } from "react";
import { toast } from "sonner";
import { recordProfileDemo } from "@/server/actions";
import { uploadDemo } from "@/features/uploads";

type Props = {
  demo: boolean;
  userId?: string | null;
  hasDemo?: boolean;
  onDemoFlag?: (has: boolean) => void;
};

/** Profile demo audio (MP3/WAV) — required before publishing offers/verses in prod. */
export function DemoAudioField({ demo, userId, hasDemo, onDemoFlag }: Props) {
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    setUploading(true);
    try {
      if (demo) {
        onDemoFlag?.(true);
        toast.success("demo set");
        return;
      }
      if (!userId) throw new Error("Sign in again to upload.");
      const up = await uploadDemo(userId, file);
      await recordProfileDemo(up);
      onDemoFlag?.(true);
      toast.success("demo uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="field">
      profile demo (MP3/WAV)
      <input
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <span className="fine">
        {uploading
          ? "uploading…"
          : hasDemo
            ? "demo on file. needed to publish offers and open verses."
            : "upload an original demo before publishing offers or applying."}
      </span>
    </label>
  );
}
