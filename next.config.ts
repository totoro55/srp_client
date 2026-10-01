import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.152.32.16"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
