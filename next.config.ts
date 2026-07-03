import type { NextConfig } from "next";

/* ------------------------------------------------------------------ */
/*  Derive allowed origins & image hosts from environment variables    */
/*  so the config works for ANY domain without code changes.           */
/* ------------------------------------------------------------------ */

/** Extract hostname from a URL string (e.g. "https://foo.bar" → "foo.bar") */
function hostname(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return url; // already a bare hostname
  }
}

/** Build a de-duplicated list, filtering out nulls */
function unique(items: (string | null | undefined)[]): string[] {
  return [...new Set(items.filter(Boolean) as string[])];
}

// --- Gather hostnames from env ---
const siteHost     = hostname(process.env.NEXT_PUBLIC_SITE_URL);
const supabaseHost = hostname(process.env.NEXT_PUBLIC_SUPABASE_URL);

const allowedOrigins = unique([
  "127.0.0.1",
  "localhost",
  siteHost,
  supabaseHost,
]);

// --- Content-Security-Policy, built from the same env-derived hosts ---
const supabaseOrigin = supabaseHost ? `https://${supabaseHost}` : "";
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  `default-src 'self'`,
  // Next.js requires 'unsafe-inline' for its bootstrap scripts; 'unsafe-eval' only needed in dev (Fast Refresh).
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://checkout.razorpay.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.razorpay.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `connect-src 'self' ${supabaseOrigin} wss://${supabaseHost ?? ""} https://*.razorpay.com`,
  `frame-src https://checkout.razorpay.com https://api.razorpay.com https://lottie.host`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'self'`,
]
  .join("; ")
  .replace(/\s+/g, " ");

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedOrigins,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
    // Optimistic client-side caching for faster navigations
    staleTimes: {
      dynamic: 30,   // cache dynamic pages for 30s
      static: 180,   // cache static pages for 3min
    },
    // Tree-shake barrel exports — only bundles icons/functions actually used
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@supabase/supabase-js",
    ],
  },
  images: {
    remotePatterns: [
      // Allow Supabase storage images from whatever URL is configured
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
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
  // HTTP headers for public assets, API responses, and site-wide security
  headers: async () => [
    {
      // Applies to every route — security headers that don't affect rendering or caching
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: csp },
      ],
    },
    {
      // Public folder assets (images, favicons, manifest)
      source: "/:path(favicon.ico|site.webmanifest|hero.jpg|.*\\.png)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ],
    },
    {
      // API routes — no aggressive caching but allow CDN stale
      source: "/api/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
