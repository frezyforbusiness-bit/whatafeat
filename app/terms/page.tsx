import Link from "next/link";

export const metadata = {
  title: "Terms — Whatafeat",
  description: "Terms of use for Whatafeat.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="back">
        ← Whatafeat
      </Link>
      <h1>Terms</h1>
      <p className="fine">Last updated: 18 September 2026. Placeholder — have counsel review before Paid live.</p>

      <h2>The service</h2>
      <p>
        Whatafeat helps independent artists find collaborators, trade verses, and (when
        enabled) book paid features. You must be old enough to form a binding contract
        in your country and able to grant the rights you promise in agreements.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of your music and files. You grant us a limited license to
        store, stream, and show them as needed to operate the platform. Do not upload
        material you do not have rights to.
      </p>

      <h2>Collaborations</h2>
      <p>
        Agreements you accept are between you and the other artist. For Paid work,
        funds may be held by the platform and released or refunded according to the
        in-product flow and Stripe’s terms. We are not a label, publisher, or escrow
        bank outside that product flow.
      </p>

      <h2>Acceptable use</h2>
      <p>
        No harassment, spam, malware, scraping at scale, or attempts to bypass access
        controls. We may suspend accounts that break these rules.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The service is provided as-is. Soft-launch features may change. Paid payouts
        require a completed Stripe Connect setup.
      </p>

      <p>
        <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
