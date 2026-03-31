import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      allowedOrigins: ["127.0.0.1", "localhost"],
    },
    // Optimistic client-side caching for faster navigations
    staleTimes: {
      dynamic: 30,   // cache dynamic pages for 30s
      static: 180,   // cache static pages for 3min
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
    // Default quality for image optimization (reduces payload)
    qualities: [70, 75, 100],
    // Reduce image formats to modern ones for smaller payloads
    formats: ["image/avif", "image/webp"],
  },
  reactCompiler: true,
  // Enable gzip compression (prod)
  compress: true,
  // Generate ETags for caching
  generateEtags: true,
  // Powered-by header removed (micro-optimization + security)
  poweredByHeader: false,
};

export default nextConfig;
