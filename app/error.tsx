"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page" style={{ padding: "48px 24px", maxWidth: 480 }}>
      <h1>Something broke.</h1>
      <p style={{ color: "var(--muted, #A0A0A0)" }}>
        Reload this screen and try again. If it keeps happening, come back later.
      </p>
      <button type="button" className="btn primary" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
