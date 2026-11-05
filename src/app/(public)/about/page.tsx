import { StepHorizon } from "@/components/stitch/step-horizon";
import Link from "next/link";
import { ArrowRight, BookOpen, Brain, GraduationCap, Users } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import type { Metadata } from "next";

const title = "About STC Academy | Building Students with Calm Rigor";
const description = "STC Academy supports learners from Primary to HSC with board-aligned, faculty-guided learning systems across GSEB and CBSE pathways. Academic rigor, mentor-led learning, inquiry first.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["STC Academy", "about", "academic rigor", "mentor-led learning", "GSEB", "CBSE", "Gujarat education"],
  alternates: { canonical: "/about" },
  openGraph: { type: "website", title, description, url: "/about" },
  twitter: { card: "summary_large_image", title, description },
};

const pillars = [
  {
    title: "Academic Rigor",
    icon: BookOpen,
    copy: "Structured progression from foundational classes to board and competitive exam readiness.",
    accent: "from-muted to-transparent",
  },
  {
    title: "Mentor-Led Learning",
    icon: Users,
    copy: "Small batches and direct faculty supervision for stronger conceptual clarity.",
    accent: "from-muted to-transparent",
  },
  {
    title: "Inquiry First",
    icon: Brain,
    copy: "Question-driven pedagogy designed to build confidence, not rote dependency.",
    accent: "from-muted to-transparent",
  },
];

export default function AboutPage() {
  return (
    <div className="overflow-x-hidden">
      <section className="relative overflow-hidden bg-gold-50 pt-14 pb-24 md:pt-20 md:pb-36">
        <StepHorizon />
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="max-w-4xl">
            <Reveal variant="fade">
              <p className="stitch-kicker">About STC</p>
            </Reveal>
            <Reveal delay={80} variant="mask-up">
              <h1 className="text-4xl font-extrabold leading-[1.05] text-primary md:text-6xl">
                Building scholars with calm rigor.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-8 max-w-3xl text-lg leading-8 text-muted-foreground">
                STC Academy supports learners from Primary to HSC with board-aligned,
                faculty-guided learning systems across GSEB and CBSE pathways.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal variant="mask-up" className="text-center">
          <p className="stitch-kicker">Our Pillars</p>
          <h2 className="mt-2 text-3xl text-primary md:text-5xl">
            What defines STC
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-4 md:grid-cols-3 md:gap-6">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.title} delay={index * 90} variant="fade-up" className="h-full">
                <article className="group relative h-full overflow-hidden rounded-xl border border-border bg-card p-6 text-center transition-all duration-300 sm:rounded-xl sm:p-8">
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${pillar.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
                  <div className="relative flex h-full flex-col items-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-primary transition-colors group-hover:bg-white">
                      <Icon className="h-7 w-7" />
                    </span>
                    <h3 className="mt-6 text-2xl font-normal text-primary sm:text-3xl">{pillar.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">{pillar.copy}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="px-6 pb-24 md:px-12 md:pb-32">
        <Reveal variant="soft-zoom">
          <div className="relative mx-auto max-w-[1280px] overflow-hidden step-cut bg-accent px-8 py-12 text-primary md:px-14 md:py-16">
                                    <div className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold text-primary">Start Your Journey</p>
                <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
                  Start with the right track
                </h2>
                <p className="mt-6 max-w-xl text-base leading-8 text-primary md:text-lg">
                  Explore curriculum levels and faculty-backed study plans based on your board and goals.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/online-courses" className="stitch-press inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:brightness-105">
                  Explore Curriculum
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/faculty" className="stitch-press rounded-xl bg-muted px-8 py-4 text-center text-base font-semibold text-primary transition hover:bg-muted">
                  Meet Faculty
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120} variant="fade">
          <div className="mx-auto mt-10 flex max-w-[1280px] items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-secondary" />
            Admissions guidance available for Primary, SSC, HSC, JEE, and NEET pathways.
          </div>
        </Reveal>
      </section>
    </div>
  );
}
