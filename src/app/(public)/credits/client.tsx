"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  Phone,
  ExternalLink,
  Github,
  Linkedin,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Code2,
  Layers,
  Palette,
  Server,
  GraduationCap,
  Heart,
  Globe,
  Instagram,
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const FOUNDER = {
  name: "Vishal Darji",
  designation: "Founder",
  phone: "7016072398",
  email: "stcinstindia@gmail.com",
  experience: "10+ Years in Education & Academic Leadership",
  photo: "/founder.png",
  vision:
    "To build a learning ecosystem where every student has access to quality education, mentorship, and the tools they need to excel — regardless of background.",
};

const DEVELOPER = {
  name: "Ved Chauhan",
  title: "Sole Developer, System Architect & Full Stack Engineer",
  phone: "7228000812",
  email: "VEDCHAUHAN2107@GMAIL.COM",
  portfolio: "https://ved.exe.snowbros.me/",
  github: "https://github.com/VED2107",
  linkedin: "https://www.linkedin.com/in/ved-chauhan2107/",
  instagram: "https://www.instagram.com/_v_e_d_2107/",
  photo: "/developer.jpeg",
  tagline:
    "Independently designed, engineered, and delivered the entire STC platform from architecture to deployment.",
};

const ENGINEERING_STATS = [
  { label: "Lines of Code", value: "50,000+" },
  { label: "Components Built", value: "60+" },
  { label: "API Endpoints", value: "20+" },
  { label: "Database Tables", value: "16" },
];

const SKILLS = [
  { label: "Frontend Architecture", icon: Layers },
  { label: "Backend Engineering", icon: Server },
  { label: "UI/UX Design", icon: Palette },
  { label: "System Architecture", icon: Code2 },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group/copy inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 opacity-50 transition-opacity group-hover/copy:opacity-100" />
      )}
      <span className="font-mono text-xs">{text}</span>
    </button>
  );
}

function FloatingParticles() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !containerRef.current) return;

    const particles = containerRef.current.querySelectorAll(".particle");
    particles.forEach((p) => {
      gsap.to(p, {
        y: "random(-40, 40)",
        x: "random(-20, 20)",
        opacity: "random(0.15, 0.5)",
        duration: "random(4, 8)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: "random(0, 3)",
      });
    });
  }, []);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="particle absolute h-1 w-1 rounded-full bg-secondary/30"
          style={{
            left: `${(i * 8.3) % 100}%`,
            top: `${(i * 13.7) % 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function GradientMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[-25%] top-[-25%] h-[600px] w-[600px] rounded-full bg-gradient-to-br from-secondary/8 to-transparent blur-3xl" />
      <div className="absolute bottom-[-25%] right-[-25%] h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-accent/6 to-transparent blur-3xl" />
      <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-secondary/4 to-accent/4 blur-3xl" />
    </div>
  );
}

export function CreditsPage() {
  const heroRef = useRef<HTMLElement>(null);
  const founderRef = useRef<HTMLElement>(null);
  const developerRef = useRef<HTMLElement>(null);
  const closingRef = useRef<HTMLElement>(null);
  const titleWordsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const founderCardRef = useRef<HTMLDivElement>(null);
  const developerCardRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);
  const socialsRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLAnchorElement>(null);
  const closingContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const onComplete = { clearProps: "all" };

      // Hero: staggered word reveal
      if (titleWordsRef.current.length > 0) {
        gsap.fromTo(
          titleWordsRef.current.filter(Boolean),
          { y: 60, opacity: 0, rotateX: -15 },
          { y: 0, opacity: 1, rotateX: 0, duration: 1, stagger: 0.08, ease: "power3.out", delay: 0.3, ...onComplete },
        );
      }

      // Hero subtitle + kicker
      gsap.fromTo(".hero-kicker",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", delay: 0.1, ...onComplete },
      );

      gsap.fromTo(".hero-subtitle",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: "power2.out", delay: 0.9, ...onComplete },
      );

      gsap.fromTo(".hero-scroll-cue",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", delay: 1.2, ...onComplete },
      );

      // Founder section
      if (founderCardRef.current) {
        gsap.fromTo(founderCardRef.current,
          { scale: 0.9, opacity: 0, y: 60 },
          {
            scale: 1, opacity: 1, y: 0, duration: 1, ease: "power3.out", ...onComplete,
            scrollTrigger: { trigger: founderCardRef.current, start: "top 80%", toggleActions: "play none none none" },
          },
        );
      }

      // Founder section kicker + title
      gsap.fromTo(".founder-header > *",
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, stagger: 0.1, duration: 0.9, ease: "power3.out", ...onComplete,
          scrollTrigger: { trigger: ".founder-header", start: "top 85%" },
        },
      );

      // Developer section
      gsap.fromTo(".developer-header > *",
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, stagger: 0.1, duration: 0.9, ease: "power3.out", ...onComplete,
          scrollTrigger: { trigger: ".developer-header", start: "top 85%" },
        },
      );

      if (developerCardRef.current) {
        gsap.fromTo(developerCardRef.current,
          { y: 80, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 1.1, ease: "power3.out", ...onComplete,
            scrollTrigger: { trigger: developerCardRef.current, start: "top 80%" },
          },
        );
      }

      // Stats counter animation
      if (statsRef.current) {
        gsap.fromTo(statsRef.current.querySelectorAll(".stat-item"),
          { y: 30, opacity: 0 },
          {
            y: 0, opacity: 1, stagger: 0.1, duration: 0.7, ease: "power2.out", ...onComplete,
            scrollTrigger: { trigger: statsRef.current, start: "top 80%" },
          },
        );
      }

      // Skills
      if (skillsRef.current) {
        gsap.fromTo(skillsRef.current.querySelectorAll(".skill-item"),
          { x: -30, opacity: 0 },
          {
            x: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: "power2.out", ...onComplete,
            scrollTrigger: { trigger: skillsRef.current, start: "top 85%" },
          },
        );
      }

      // Social icons
      if (socialsRef.current) {
        gsap.fromTo(socialsRef.current.querySelectorAll(".social-item"),
          { scale: 0, opacity: 0 },
          {
            scale: 1, opacity: 1, stagger: 0.06, duration: 0.5, ease: "back.out(1.7)", ...onComplete,
            scrollTrigger: { trigger: socialsRef.current, start: "top 85%" },
          },
        );
      }

      // Portfolio CTA emphasis
      if (portfolioRef.current) {
        gsap.fromTo(portfolioRef.current,
          { scale: 0.8, opacity: 0 },
          {
            scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.5)", clearProps: "transform,opacity",
            scrollTrigger: { trigger: portfolioRef.current, start: "top 85%" },
          },
        );

        gsap.to(portfolioRef.current.querySelector(".portfolio-glow"), {
          opacity: 0.6,
          scale: 1.05,
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }

      // Closing section
      if (closingContentRef.current) {
        gsap.fromTo(closingContentRef.current.children,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, stagger: 0.12, duration: 0.9, ease: "power3.out", ...onComplete,
            scrollTrigger: { trigger: closingContentRef.current, start: "top 80%" },
          },
        );
      }
    });

    return () => ctx.revert();
  }, []);

  const heroWords = "Meet The Minds Behind STC".split(" ");

  return (
    <div className="overflow-x-hidden">
      {/* ─── Hero ─── */}
      <section
        ref={heroRef}
        className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-muted py-24 md:py-32 lg:py-40"
      >
        <GradientMesh />
        <FloatingParticles />

        <div className="relative z-10 mx-auto max-w-[1600px] px-6 text-center md:px-12">
          <p className="hero-kicker stitch-kicker">Credits & Founders</p>

          <h1 className="mt-6 text-5xl font-light italic leading-tight text-primary md:text-7xl xl:text-8xl">
            {heroWords.map((word, i) => (
              <span
                key={i}
                ref={(el) => { titleWordsRef.current[i] = el; }}
                className={cn(
                  "inline-block mr-[0.25em]",
                  word === "STC" && "text-secondary"
                )}
                style={{ perspective: "400px" }}
              >
                {word}
              </span>
            ))}
          </h1>

          <p className="hero-subtitle mx-auto mt-8 max-w-3xl text-base font-light leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            A showcase of the vision, leadership, and engineering behind the
            Student Tracking & Campus Management Platform.
          </p>

          <div className="hero-scroll-cue mt-16 flex flex-col items-center gap-2 text-muted-foreground/50">
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll to explore</span>
            <div className="h-8 w-px bg-gradient-to-b from-muted-foreground/30 to-transparent" />
          </div>
        </div>
      </section>

      {/* ─── Founder Showcase ─── */}
      <section ref={founderRef} className="relative py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <div className="founder-header max-w-3xl">
            <p className="stitch-kicker">The Visionary</p>
            <h2 className="mt-4 text-4xl font-light italic text-primary sm:text-5xl md:text-6xl lg:text-7xl">
              Founded on a <span className="text-secondary">mission</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Behind every great institution is a leader with unwavering vision.
              STC Academy was born from a commitment to accessible, quality education.
            </p>
          </div>

          <div ref={founderCardRef} className="mt-16">
            <div className="relative overflow-hidden rounded-[28px] border border-black/[0.04] bg-white p-1 shadow-[0_32px_80px_-32px_rgba(26,28,29,0.12)]">
              <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-secondary/5 via-transparent to-accent/5" />
              <div className="relative rounded-[24px] bg-white p-6 sm:p-8 md:p-10 lg:p-12">
                <div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-14">
                  {/* Photo */}
                  <div className="group relative shrink-0">
                    <div className="absolute -inset-2 rounded-[28px] bg-gradient-to-br from-secondary/20 to-accent/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="relative h-48 w-48 overflow-hidden rounded-[24px] bg-muted sm:h-56 sm:w-56 lg:h-64 lg:w-64">
                      <Image
                        src={FOUNDER.photo}
                        alt={FOUNDER.name}
                        fill
                        sizes="(min-width: 1024px) 256px, (min-width: 640px) 224px, 192px"
                        className="object-cover object-top"
                      />
                      <div className="absolute inset-0 rounded-[24px] ring-1 ring-inset ring-black/5" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-6">
                    <div>
                      <h3 className="font-heading text-3xl font-bold text-primary sm:text-4xl">
                        {FOUNDER.name}
                      </h3>
                      <p className="mt-1 text-lg font-medium text-secondary">
                        {FOUNDER.designation}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full bg-secondary/8 px-4 py-2 text-sm font-medium text-secondary">
                      <Sparkles className="h-4 w-4" />
                      {FOUNDER.experience}
                    </div>

                    <p className="max-w-xl text-base leading-relaxed text-muted-foreground italic">
                      &ldquo;{FOUNDER.vision}&rdquo;
                    </p>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
                      <CopyButton text={FOUNDER.phone} label="phone number" />
                      <CopyButton text={FOUNDER.email} label="email" />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <a
                        href={`tel:${FOUNDER.phone}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground/60 transition-all hover:-translate-y-0.5 hover:bg-secondary hover:text-white hover:shadow-lg"
                        aria-label="Call founder"
                      >
                        <Phone className="h-5 w-5" />
                      </a>
                      <a
                        href={`mailto:${FOUNDER.email}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground/60 transition-all hover:-translate-y-0.5 hover:bg-secondary hover:text-white hover:shadow-lg"
                        aria-label="Email founder"
                      >
                        <Mail className="h-5 w-5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-black/8 to-transparent" />
      </div>

      {/* ─── Powered By Showcase ─── */}
      <section ref={developerRef} className="relative py-24 md:py-32 lg:py-40">
        <GradientMesh />

        <div className="relative z-10 mx-auto max-w-[1600px] px-6 md:px-12">
          <div className="developer-header max-w-3xl">
            <p className="stitch-kicker">Powered By</p>
            <h2 className="mt-4 text-4xl font-light italic text-primary sm:text-5xl md:text-6xl lg:text-7xl">
              Engineered with <span className="text-secondary">precision</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              The entire STC platform — every component, every API endpoint, every pixel — was
              independently designed, engineered, and delivered by a single developer.
            </p>
          </div>

          {/* Developer card */}
          <div ref={developerCardRef} className="mt-16">
            <div className="relative overflow-hidden rounded-[28px] border border-black/[0.04] bg-white p-1 shadow-[0_32px_80px_-32px_rgba(26,28,29,0.12)]">
              <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-secondary/5 via-transparent to-accent/8" />
              <div className="relative rounded-[24px] bg-white">
                <div className="p-6 sm:p-8 md:p-10 lg:p-12">
                  <div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-14">
                    {/* Photo */}
                    <div className="group relative shrink-0">
                      <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-secondary/25 to-accent/25 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="relative h-48 w-48 overflow-hidden rounded-[24px] bg-muted sm:h-56 sm:w-56 lg:h-64 lg:w-64">
                        <Image
                          src={DEVELOPER.photo}
                          alt={DEVELOPER.name}
                          fill
                          sizes="(min-width: 1024px) 256px, (min-width: 640px) 224px, 192px"
                          className="object-cover object-top"
                        />
                        <div className="absolute inset-0 rounded-[24px] ring-1 ring-inset ring-black/5" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-6">
                      <div>
                        <h3 className="font-heading text-3xl font-bold text-primary sm:text-4xl">
                          {DEVELOPER.name}
                        </h3>
                        <p className="mt-1 text-base font-medium text-secondary sm:text-lg">
                          {DEVELOPER.title}
                        </p>
                      </div>

                      <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                        {DEVELOPER.tagline}
                      </p>

                      {/* Skills */}
                      <div ref={skillsRef} className="flex flex-wrap gap-2">
                        {SKILLS.map((skill) => {
                          const Icon = skill.icon;
                          return (
                            <span
                              key={skill.label}
                              className="skill-item inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary/10 hover:text-secondary"
                            >
                              <Icon className="h-3 w-3" />
                              {skill.label}
                            </span>
                          );
                        })}
                      </div>

                      {/* Contact */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-secondary" />
                          <CopyButton text={DEVELOPER.phone} label="phone number" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-secondary" />
                          <CopyButton text={DEVELOPER.email} label="email" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats bar */}
                <div
                  ref={statsRef}
                  className="border-t border-black/[0.04] bg-muted/30 px-6 py-6 sm:px-8 md:px-10 lg:px-12"
                >
                  <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
                    {ENGINEERING_STATS.map((stat) => (
                      <div key={stat.label} className="stat-item text-center md:text-left">
                        <p className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social + Portfolio */}
                <div className="border-t border-black/[0.04] px-6 py-6 sm:px-8 md:px-10 lg:px-12">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    {/* Social links */}
                    <div ref={socialsRef} className="flex items-center gap-3">
                      <a
                        href={DEVELOPER.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-item group/social flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground/60 transition-all hover:-translate-y-0.5 hover:bg-foreground hover:text-white hover:shadow-lg"
                        aria-label="GitHub"
                      >
                        <Github className="h-5 w-5" />
                      </a>
                      <a
                        href={DEVELOPER.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-item group/social flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground/60 transition-all hover:-translate-y-0.5 hover:bg-[#0a66c2] hover:text-white hover:shadow-lg"
                        aria-label="LinkedIn"
                      >
                        <Linkedin className="h-5 w-5" />
                      </a>
                      <a
                        href={DEVELOPER.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-item group/social flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground/60 transition-all hover:-translate-y-0.5 hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] hover:text-white hover:shadow-lg"
                        aria-label="Instagram"
                      >
                        <Instagram className="h-5 w-5" />
                      </a>
                      <a
                        href={`mailto:${DEVELOPER.email}`}
                        className="social-item group/social flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground/60 transition-all hover:-translate-y-0.5 hover:bg-secondary hover:text-white hover:shadow-lg"
                        aria-label="Email"
                      >
                        <Mail className="h-5 w-5" />
                      </a>
                    </div>

                    {/* Portfolio CTA */}
                    <a
                      ref={portfolioRef}
                      href={DEVELOPER.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/portfolio relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-secondary to-secondary/80 px-7 py-4 text-base font-semibold text-white shadow-[0_8px_30px_-8px_rgba(115,92,0,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_rgba(115,92,0,0.5)]"
                    >
                      <div className="portfolio-glow pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-accent/30 to-secondary/30 opacity-0 blur-xl" />
                      <Globe className="relative h-5 w-5" />
                      <span className="relative">Visit Portfolio</span>
                      <ExternalLink className="relative h-4 w-4 transition-transform group-hover/portfolio:translate-x-0.5 group-hover/portfolio:-translate-y-0.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Closing ─── */}
      <section ref={closingRef} className="relative overflow-hidden py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <div className="relative overflow-hidden rounded-[28px] bg-primary px-8 py-16 md:px-16 md:py-24">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/[0.03]" />
            <div className="pointer-events-none absolute -bottom-12 left-1/4 h-40 w-40 rounded-full bg-white/[0.04]" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

            <div ref={closingContentRef} className="relative mx-auto max-w-3xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <GraduationCap className="h-8 w-8 text-accent" />
              </div>

              <h2 className="mt-8 text-4xl font-light text-white sm:text-5xl md:text-6xl">
                Building the future of{" "}
                <span className="italic text-accent">education</span>
              </h2>

              <p className="mt-6 text-base leading-relaxed text-white/60 md:text-lg">
                STC Academy is more than a platform — it&apos;s a commitment to
                transforming how students learn, how teachers teach, and how
                institutions grow. Every line of code, every design decision, and
                every feature was crafted with one goal: empowering education.
              </p>

              <div className="mt-10 flex items-center justify-center gap-2 text-sm text-white/40">
                <span>Made with</span>
                <Heart className="h-4 w-4 text-red-400" />
                <span>for education</span>
              </div>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/courses"
                  className="stitch-press inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Explore Courses
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/about"
                  className="stitch-press rounded-xl bg-white/10 px-8 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
                >
                  About STC
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
