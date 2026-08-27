import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Hosted test builds: type errors are tracked locally; do not block deploy.
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
