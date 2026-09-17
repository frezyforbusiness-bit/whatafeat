"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  if (process.env.NEXT_PUBLIC_DEMO !== "0") {
    return (
      <main className="page" style={{ maxWidth: 480, paddingTop: 80 }}>
        <h1>Demo mode</h1>
        <p>Local demo is enabled. Use Choose demo account from the app.</p>
        <Link className="btn primary" href="/">
          Back to Discover
        </Link>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 480, paddingTop: 80 }}>
      <p className="eyebrow">WHATAFEAT</p>
      <h1 style={{ fontSize: 32, margin: "12px 0" }}>Sign in to collaborate.</h1>
      <p style={{ marginBottom: 28 }}>
        Use Google to create your artist account. Payments for paid features arrive later —
        trades work today.
      </p>
      <button className="btn primary full" type="button" onClick={() => signIn("google", { callbackUrl: "/onboarding" })}>
        Continue with Google
      </button>
      <p className="fine" style={{ marginTop: 20 }}>
        By continuing you agree to use Whatafeat for independent collaboration. No payment is
        taken at sign-in.
      </p>
    </main>
  );
}
