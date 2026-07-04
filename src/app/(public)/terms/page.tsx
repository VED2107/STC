import { FileCheck } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import type { Metadata } from "next";

const title = "Terms of Service - STC Academy | Service Agreement & Policies";
const description = "STC Academy terms of service covering class policies, attendance requirements, academic integrity rules, fee policies, and resource access rules.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["terms of service", "service agreement", "class policies", "STC Academy terms"],
  alternates: { canonical: "/terms" },
  openGraph: { type: "website", title, description, url: "/terms" },
  twitter: { card: "summary_large_image", title, description },
};

export default function TermsPage() {
  return (
    <div className="overflow-x-hidden">
      <section className="relative bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6 md:px-10">
          <Reveal variant="fade">
            <p className="stitch-kicker">Terms</p>
          </Reveal>
          <Reveal delay={80} variant="mask-up">
            <h1 className="mt-4 text-5xl font-light italic text-primary md:text-6xl xl:text-7xl">Terms of Service</h1>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 md:px-10 md:py-32">
        <Reveal variant="fade-up">
          <div className="stitch-panel relative overflow-hidden p-8 md:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/25 to-transparent" />
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <FileCheck className="h-7 w-7" />
            </span>
            <h2 className="mt-6 text-3xl italic text-primary">Service Agreement</h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">
              By using STC Academy services, students and guardians agree to follow
              class policies, attendance requirements, and academic integrity rules.
            </p>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Fee policies, scheduling updates, and resource access rules are set by
              the academy and may be revised each term.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
