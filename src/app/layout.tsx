import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "STC Academy | The Modern Scholar",
    template: "%s | STC Academy",
  },
  description:
    "An editorial academic platform for STC Tuition Centre across admissions, curriculum, faculty, and student mastery.",
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
      className={`${newsreader.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
