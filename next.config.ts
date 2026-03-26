import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 不需要 standalone output
  // output: "standalone",
  serverExternalPackages: ["@auth/d1-adapter", "@opennextjs/cloudflare"],
};

export default nextConfig;
