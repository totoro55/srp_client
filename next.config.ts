import {NextConfig} from "next";

const nextConfig:NextConfig= {
    experimental: {
        optimizePackageImports: ['lucide-react'],
    },
  /* config options here */
};

module.exports = {
    allowedDevOrigins: ['10.152.32.16'],
}


export default nextConfig;
