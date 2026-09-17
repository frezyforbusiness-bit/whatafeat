import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for Docker/self-host only. On Vercel it breaks NFT tracing
  // (ENOENT .next/next-server.js.nft.json). Vercel sets VERCEL=1.
  ...(process.env.DOCKER_BUILD === "1" && !process.env.VERCEL
    ? { output: "standalone" as const }
    : {}),
};

export default nextConfig;
