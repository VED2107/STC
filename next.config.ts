import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      allowedOrigins: ["127.0.0.1", "localhost"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "czwpbzvhodwkochhvjuw.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    qualities: [70, 75, 100],
  },
  reactCompiler: true,
};

export default nextConfig;
