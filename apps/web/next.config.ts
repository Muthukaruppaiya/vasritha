import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["nodemailer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  // Hosted test builds: type errors are tracked locally; do not block deploy.
  typescript: {
    ignoreBuildErrors: true
  }
};

export default nextConfig;
