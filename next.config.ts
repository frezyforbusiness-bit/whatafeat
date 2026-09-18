import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Standalone is for Docker/self-host only. On Vercel it breaks NFT tracing
  // (ENOENT .next/next-server.js.nft.json). Vercel sets VERCEL=1.
  ...(process.env.DOCKER_BUILD === "1" && !process.env.VERCEL
    ? { output: "standalone" as const }
    : {}),
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Skip source-map upload unless CI has a token — build must not fail without it.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  widenClientFileUpload: false,
  disableLogger: true,
  webpack: {
    automaticVercelMonitors: false,
  },
});
