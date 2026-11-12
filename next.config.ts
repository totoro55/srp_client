import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["10.152.32.16", "192.168.3.141"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
