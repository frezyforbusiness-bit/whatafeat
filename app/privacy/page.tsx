import Link from "next/link";

export const metadata = {
  title: "Privacy — Whatafeat",
  description: "How Whatafeat handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="back">
        ← Whatafeat
      </Link>
      <h1>Privacy</h1>
      <p className="fine">Last updated: 18 September 2026. Placeholder — have counsel review before Paid live.</p>

      <h2>What we collect</h2>
      <p>
        Account details from Google sign-in (name, email, profile image), the artist
        profile you create, audio demos and delivery files you upload, messages and
        proposals you send, and payment metadata when Paid is enabled (handled by
        Stripe; we store identifiers and settlement state, not full card numbers).
      </p>

      <h2>How we use it</h2>
      <p>
        To run collaborations, show your public profile, deliver private files only to
        participants, prevent abuse, and process payouts/refunds when payments are on.
      </p>

      <h2>Storage</h2>
      <p>
        Data lives on Neon (Postgres), Vercel Blob (files), Auth.js sessions, and Stripe
        when payments are enabled. Private delivery files are not public Blob URLs.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your data. Processors: Google (sign-in), Vercel (hosting/storage),
        Neon (database), Stripe (payments), and error monitoring if configured.
      </p>

      <h2>Contact</h2>
      <p>Questions: use the Report control in the app or contact the operator of this deployment.</p>

      <p>
        <Link href="/terms">Terms</Link>
      </p>
    </main>
  );
}
