import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables a smaller Node image for Docker / self-host.
  // Vercel uses its own Next.js builder and ignores container output.
  output: "standalone",
};

export default nextConfig;
