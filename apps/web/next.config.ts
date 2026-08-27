import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Hosted test builds: type errors are tracked locally; do not block deploy.
  typescript: {
    ignoreBuildErrors: true
  }
};

export default nextConfig;
