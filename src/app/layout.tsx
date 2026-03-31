import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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

export const metadata: Metadata = {
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
          href="https://czwpbzvhodwkochhvjuw.supabase.co"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://czwpbzvhodwkochhvjuw.supabase.co"
        />
        {/* Pre-connect to Google Fonts CDN (fonts are already preloaded by next/font but static assets load from gstatic) */}
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
