import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Cloudflare Pages 不需要 standalone output
  // output: "standalone",
  serverExternalPackages: ["@auth/d1-adapter"],
};

export default nextConfig;
