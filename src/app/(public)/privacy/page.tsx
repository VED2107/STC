import { ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import type { Metadata } from "next";

const title = "Privacy Policy - STC Academy | Data Protection & Student Information";
const description = "STC Academy's privacy policy for student and guardian information usage in admissions, academic operations, attendance communication, and course delivery.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["privacy policy", "data protection", "student information", "STC Academy privacy"],
  alternates: { canonical: "/privacy" },
  openGraph: { type: "website", title, description, url: "/privacy" },
  twitter: { card: "summary_large_image", title, description },
};

export default function PrivacyPage() {
  return (
    <div className="overflow-x-hidden">
      <section className="relative bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6 md:px-10">
          <Reveal variant="fade">
            <p className="stitch-kicker">Privacy</p>
          </Reveal>
          <Reveal delay={80} variant="mask-up">
            <h1 className="mt-4 text-5xl font-light italic text-primary md:text-6xl xl:text-7xl">Privacy Policy</h1>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 md:px-10 md:py-32">
        <Reveal variant="fade-up">
          <div className="stitch-panel relative overflow-hidden p-8 md:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/25 to-transparent" />
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <h2 className="mt-6 text-3xl italic text-primary">Data Usage</h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">
              STC Academy uses student and guardian information only for admissions,
              academic operations, attendance communication, and course delivery.
            </p>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              For account deletion or data correction requests, contact the academy
              admin desk using the email listed in the footer.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
