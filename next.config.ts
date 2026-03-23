import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@auth/d1-adapter"],
};

export default nextConfig;
