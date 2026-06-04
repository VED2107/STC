import Link from "next/link";
import { ArrowRight, BookOpen, Brain, GraduationCap, Users } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About STC Academy | Building Scholars with Calm Rigor",
  description: "STC Academy supports learners from Primary to HSC with board-aligned, faculty-guided learning systems across GSEB and CBSE pathways. Academic rigor, mentor-led learning, inquiry first.",
  keywords: ["STC Academy", "about", "academic rigor", "mentor-led learning", "GSEB", "CBSE", "Gujarat education"],
};

const pillars = [
  {
    title: "Academic Rigor",
    icon: BookOpen,
    copy: "Structured progression from foundational classes to board and competitive exam readiness.",
    accent: "from-[#d0e9d4]/30 to-transparent",
  },
  {
    title: "Mentor-Led Learning",
    icon: Users,
    copy: "Small batches and direct faculty supervision for stronger conceptual clarity.",
    accent: "from-[#eef2ff]/40 to-transparent",
  },
  {
    title: "Inquiry First",
    icon: Brain,
    copy: "Question-driven pedagogy designed to build confidence, not rote dependency.",
    accent: "from-[#f1edff]/40 to-transparent",
  },
];

export default function AboutPage() {
  return (
    <div className="overflow-x-hidden">
      <section className="relative bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <div className="max-w-4xl">
            <Reveal variant="fade">
              <p className="stitch-kicker">About STC</p>
            </Reveal>
            <Reveal delay={80} variant="mask-up">
              <h1 className="mt-4 text-5xl font-light italic leading-tight text-primary md:text-7xl xl:text-8xl">
                Building scholars with <span className="text-secondary">calm rigor</span>.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-8 max-w-3xl text-base font-light leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
                STC Academy supports learners from Primary to HSC with board-aligned,
                faculty-guided learning systems across GSEB and CBSE pathways.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        <Reveal variant="mask-up" className="text-center">
          <p className="stitch-kicker">Our Pillars</p>
          <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
            What defines <span className="italic text-secondary">STC</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-4 md:grid-cols-3 md:gap-6">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.title} delay={index * 90} variant="fade-up" className="h-full">
                <article className="group relative h-full overflow-hidden rounded-[20px] border border-black/[0.04] bg-white p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(26,28,29,0.15)] sm:rounded-[24px] sm:p-8">
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${pillar.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
                  <div className="relative flex h-full flex-col items-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-primary transition-colors group-hover:bg-white">
                      <Icon className="h-7 w-7" />
                    </span>
                    <h3 className="mt-6 text-2xl font-normal italic text-primary sm:text-3xl">{pillar.title}</h3>
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
          <div className="relative mx-auto max-w-[1600px] overflow-hidden rounded-[28px] bg-primary px-8 py-14 md:px-16 md:py-20">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/[0.03]" />
            <div className="pointer-events-none absolute -bottom-8 left-1/4 h-32 w-32 rounded-full bg-white/[0.04]" />
            <div className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">Start Your Journey</p>
                <h2 className="mt-4 text-4xl font-light text-white sm:text-5xl md:text-6xl">
                  Start with the right <span className="italic text-accent">track</span>
                </h2>
                <p className="mt-6 max-w-xl text-base leading-8 text-white md:text-lg">
                  Explore curriculum levels and faculty-backed study plans based on your board and goals.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/online-courses" className="stitch-press inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:brightness-105">
                  Explore Curriculum
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/faculty" className="stitch-press rounded-xl bg-white/10 px-8 py-4 text-center text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15">
                  Meet Faculty
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120} variant="fade">
          <div className="mx-auto mt-10 flex max-w-[1600px] items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-secondary" />
            Admissions guidance available for Primary, SSC, HSC, JEE, and NEET pathways.
          </div>
        </Reveal>
      </section>
    </div>
  );
}
