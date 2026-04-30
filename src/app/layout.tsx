import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],  // Only weights actually used in UI
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

/** Viewport config — extracted so Next.js can serve it in the initial HTML head */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "STC Academy | The Modern Scholar",
    template: "%s | STC Academy",
  },
  description:
    "STC Tuition Centre provides high-quality study materials and excellent education across every course and level.",
  keywords: [
    "tuition",
    "coaching",
    "GSEB",
    "NCERT",
    "SSC",
    "HSC",
    "Gujarat",
    "STC",
    "education",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: "STC Academy",
    title: "STC Academy | The Modern Scholar",
    description:
      "STC Tuition Centre provides high-quality study materials and excellent education across every course and level.",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "STC Academy",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${nunito.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Pre-connect to Supabase for faster API / storage requests */}
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
        />
        {/* Pre-connect to Google Fonts CDN (fonts are already preloaded by next/font but static assets load from gstatic) */}
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
