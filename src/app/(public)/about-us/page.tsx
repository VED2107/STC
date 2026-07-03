import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, Mail, MapPin, Phone, Sparkles, Target, Users } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us - STC Tuition Centre | Excellence in Education Since 2010",
  description: "Learn about STC Tuition Centre's mission to provide excellent teaching, strong study materials, and practical guidance to help school students learn with confidence across Gujarat.",
  keywords: ["STC Tuition Centre", "about us", "Vishal Darji", "Gujarat education", "tuition centre history"],
  alternates: { canonical: "/about-us" },
};

const values = [
  {
    title: "Clarity First",
    description: "Every concept is broken down to its simplest form — we believe understanding comes before speed.",
    icon: Target,
    accent: "from-[#d0e9d4]/30 to-transparent",
  },
  {
    title: "Expert Mentorship",
    description: "Qualified faculty who know their subjects deeply and care about each student's progress.",
    icon: Users,
    accent: "from-[#eef2ff]/40 to-transparent",
  },
  {
    title: "Strong Materials",
    description: "Curated study resources designed for retention — not volume, but quality and relevance.",
    icon: BookOpen,
    accent: "from-[#fff2dc]/40 to-transparent",
  },
  {
    title: "Result Oriented",
    description: "Structured preparation that builds exam confidence through practice, feedback, and conceptual depth.",
    icon: Sparkles,
    accent: "from-[#f1edff]/40 to-transparent",
  },
];

const milestones = [
  { year: "2010", label: "Founded by Vishal Darji with a vision for quality education" },
  { year: "2015", label: "Expanded to cover SSC & HSC board preparation tracks" },
  { year: "2020", label: "Launched digital materials and online course delivery" },
  { year: "2024", label: "Full-stack academy platform with live curriculum and attendance" },
];

const contactItems = [
  {
    label: "Campus",
    value: "STC Academy, Gujarat",
    href: "https://share.google/E1n2yltTbAqfN9UAd",
    icon: MapPin,
  },
  {
    label: "Call Us",
    value: "7016072398 · 8160576043",
    href: "tel:7016072398",
    icon: Phone,
  },
  {
    label: "Email",
    value: "stcinstindia@gmail.com",
    href: "mailto:stcinstindia@gmail.com",
    icon: Mail,
  },
];

export default function AboutUsPage() {
  return (
    <div className="overflow-x-hidden">
      {/* HERO */}
      <section className="relative bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <div className="max-w-3xl">
            <Reveal variant="fade">
              <p className="stitch-kicker">About Us</p>
            </Reveal>
            <Reveal delay={80} variant="mask-up">
              <h1 className="mt-4 text-5xl font-light italic leading-tight text-primary md:text-7xl xl:text-8xl">
                Building confident <span className="text-secondary">scholars</span> since 2010.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-8 max-w-2xl text-base font-light leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
                STC Academy is focused on excellent teaching, strong study materials, and practical guidance
                to help school students learn with confidence across Gujarat&apos;s most important academic milestones.
              </p>
            </Reveal>
            <Reveal delay={240} variant="soft-zoom">
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link href="/online-courses" className="stitch-press inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(26,28,29,0.35)]">
                  View Curriculum
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/faculty" className="stitch-press rounded-xl bg-accent px-8 py-4 text-center text-base font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(26,28,29,0.12)]">
                  Meet Faculty
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <Reveal variant="mask-up">
            <div>
              <p className="stitch-kicker">The Founder</p>
              <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
                <span className="italic text-secondary">Vishal Darji</span>
              </h2>
              <p className="mt-6 text-base leading-8 text-muted-foreground md:text-lg">
                With a deep commitment to quality education, Vishal Darji founded STC Academy to bridge the gap between
                rote learning and genuine understanding. His vision: every student deserves access to clear concepts,
                strong academic foundations, and result-oriented guidance.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120} variant="soft-zoom">
            <div className="stitch-panel relative overflow-hidden p-8 md:p-10">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/25 to-transparent" />
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <GraduationCap className="h-8 w-8" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">Founder & Director</p>
                  <p className="mt-1 text-2xl italic text-primary">Vishal Darji</p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-7 text-muted-foreground">
                &ldquo;We don&apos;t teach for marks alone — we teach for understanding. When concepts are clear,
                confidence follows naturally.&rdquo;
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* VALUES */}
      <section className="bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <Reveal variant="mask-up" className="text-center">
            <p className="stitch-kicker">Our Values</p>
            <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
              What makes STC <span className="italic text-secondary">different</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-4">
            {values.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={index * 90} variant="fade-up" className="h-full">
                  <div className="group relative h-full overflow-hidden rounded-[20px] border border-black/[0.04] bg-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(26,28,29,0.15)] sm:rounded-[24px] sm:p-8">
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${item.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
                    <div className="relative flex h-full flex-col items-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-primary transition-colors group-hover:bg-white sm:h-14 sm:w-14 sm:rounded-2xl">
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                      </span>
                      <h3 className="mt-4 text-lg font-normal italic text-primary sm:mt-6 sm:text-2xl">{item.title}</h3>
                      <p className="mt-3 text-xs leading-6 text-muted-foreground sm:mt-4 sm:text-sm sm:leading-7">{item.description}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* JOURNEY */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        <Reveal variant="mask-up" className="max-w-2xl">
          <p className="stitch-kicker">Our Journey</p>
          <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
            Growing with <span className="italic text-secondary">purpose</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {milestones.map((item, index) => (
            <Reveal key={item.year} delay={index * 100} variant="soft-zoom">
              <div className="stitch-panel stitch-hover-lift relative overflow-hidden p-6 sm:p-8">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/25 to-transparent" />
                <p className="font-heading text-4xl italic text-secondary sm:text-5xl">{item.year}</p>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section className="bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <Reveal variant="mask-up" className="text-center">
            <p className="stitch-kicker">Get In Touch</p>
            <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
              Visit the <span className="italic text-secondary">academy</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {contactItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.label} delay={index * 90} variant="fade-up">
                  <a
                    href={item.href}
                    target={item.label === "Campus" ? "_blank" : undefined}
                    rel={item.label === "Campus" ? "noreferrer" : undefined}
                    className="stitch-panel stitch-hover-lift block cursor-pointer p-6 text-center sm:p-8"
                  >
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                      <Icon className="h-6 w-6" />
                    </span>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">{item.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.value}</p>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 md:px-12 md:py-32">
        <Reveal variant="soft-zoom">
          <div className="relative mx-auto max-w-[1600px] overflow-hidden rounded-[28px] bg-primary px-8 py-14 md:px-16 md:py-20">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/[0.03]" />
            <div className="pointer-events-none absolute -bottom-8 left-1/4 h-32 w-32 rounded-full bg-white/[0.04]" />
            <div className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">Start Your Journey</p>
                <h2 className="mt-4 text-4xl font-light text-white sm:text-5xl md:text-6xl">
                  Ready to join the <span className="italic text-accent">STC family?</span>
                </h2>
                <p className="mt-6 max-w-xl text-base leading-8 text-white md:text-lg">
                  Experience quality education built around clear concepts, strong foundations, and long-term academic growth.
                </p>
              </div>
              <Link href="/login" className="stitch-press rounded-xl bg-accent px-10 py-5 text-center text-lg font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)] hover:brightness-105">
                Begin Application
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
