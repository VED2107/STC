import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Building2, Flame, GraduationCap, Microscope, Sparkles } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import { HeroMedia } from "@/components/stitch/hero-media";
import { AnnouncementBadge } from "@/components/stitch/announcement-badge";

const stats = [
  { value: "99%", label: "Passing Students" },
  { value: "30:1", label: "Student-Teacher Ratio" },
  { value: "15 yrs+", label: "Teaching Experience" },
  { value: "30+", label: "Top University Admits" },
];

const departments = [
  {
    title: "Primary",
    description: "Curiosity-led foundations for Classes 1 to 5 with reading, numeracy, and confidence building.",
    href: "/courses?level=primary",
    icon: GraduationCap,
    accent: "bg-[#d0e9d4]/55 text-[#374c3d]",
    className: "md:col-span-8",
  },
  {
    title: "Middle",
    description: "Analytical growth for Classes 6 to 8 across science, mathematics, and language mastery.",
    href: "/courses?level=middle",
    icon: Building2,
    accent: "bg-[#eef2ff] text-[#3651a5]",
    className: "md:col-span-4",
  },
  {
    title: "SSC",
    description: "Board-prep discipline and exam confidence for secondary milestones.",
    href: "/courses?level=ssc",
    icon: Flame,
    accent: "bg-[#fff2dc] text-[#9a6500]",
    className: "md:col-span-4",
  },
  {
    title: "11th / HSC",
    description: "Senior academic tracks for science and commerce, with optional competitive-exam focus.",
    href: "/courses?level=hsc",
    icon: Microscope,
    accent: "bg-[#f7edf1] text-[#9a4767]",
    className: "md:col-span-4",
  },
  {
    title: "JEE / NEET",
    description: "Focused preparation pathways layered into HSC study with precision mentoring.",
    href: "/courses?level=hsc",
    icon: Brain,
    accent: "bg-[#f1edff] text-[#6a4bc4]",
    className: "md:col-span-4",
  },
];

const foundations = [
  {
    title: "NCERT Pathway",
    description: "Rigorous concept-building aligned with national competitive examinations and logic-first problem solving.",
    cta: "Explore NCERT Courses",
    href: "/courses",
  },
  {
    title: "GSEB Pathway",
    description: "Regional board excellence with local context, mentorship, and strong exam-orientation.",
    cta: "Explore GSEB Courses",
    href: "/courses",
  },
];

const differentiators = [
  {
    title: "Curated Content",
    copy: "Every module is edited for clarity, sequencing, and retention rather than volume alone.",
    icon: BookOpen,
    accent: "from-[#d0e9d4]/30 to-transparent",
  },
  {
    title: "Peer Mentorship",
    copy: "Small-batch learning creates accountability, community, and focused academic support.",
    icon: Sparkles,
    accent: "from-[#fff2dc]/40 to-transparent",
  },
  {
    title: "Inquiry First",
    copy: "We prioritize questions, discussion, and conceptual confidence before speed-drill patterns.",
    icon: Brain,
    accent: "from-[#f1edff]/40 to-transparent",
  },
];

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-muted">
        <HeroMedia />
        <div className="relative mx-auto max-w-[1600px] px-6 py-28 md:px-12 md:py-36 xl:py-44">
          <div className="flex flex-col items-center text-center">
            <Reveal variant="fade">
              <AnnouncementBadge />
            </Reveal>

            <Reveal delay={80} variant="fade">
              <div className="mt-8 flex items-center gap-3">
                <span className="h-px w-8 bg-secondary/50 sm:w-12" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-secondary/70">Est. 2010</span>
                <span className="h-px w-8 bg-secondary/50 sm:w-12" />
              </div>
            </Reveal>

            <Reveal delay={140} variant="mask-up">
              <h1 className="mt-6 text-[2.5rem] font-light leading-[1.05] text-primary sm:text-5xl md:text-7xl xl:text-8xl xl:leading-[1.04] 2xl:text-[6.5rem]">
                Cultivating the
                <br />
                <span className="italic">Intellect of Tomorrow.</span>
              </h1>
            </Reveal>

            <Reveal delay={240}>
              <p className="mx-auto mt-8 max-w-2xl text-base font-light leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
                High-quality teaching, trusted study materials, and strong conceptual learning
                for students across Gujarat&apos;s most important academic milestones.
              </p>
            </Reveal>

            <Reveal delay={320} variant="soft-zoom">
              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/about-us" className="stitch-press rounded-xl bg-primary px-8 py-4 text-center text-base font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(26,28,29,0.35)] sm:text-lg md:px-10 md:py-5">
                  Begin Your Inquiry
                </Link>
                <Link href="/courses" className="stitch-press rounded-xl bg-accent px-8 py-4 text-center text-base font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(26,28,29,0.12)] sm:text-lg md:px-10 md:py-5">
                  View Curriculum
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-10 px-6 text-center md:grid-cols-4 md:px-12">
          {stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 80} variant="fade-up">
              <div className="text-4xl text-primary sm:text-5xl">{stat.value}</div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {stat.label}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── DEPARTMENTS ── */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <Reveal variant="mask-up" className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-secondary/70">Academic Pathways</p>
            <h2 className="mt-4 text-4xl font-light leading-tight text-primary sm:text-5xl md:text-6xl">
              Departments for the <span className="italic text-secondary">Modern Scholar</span>
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground md:text-lg">
              Each academic path is designed to build clear concepts, strong practice habits,
              and confident exam performance.
            </p>
          </Reveal>
          <Reveal delay={120} variant="fade">
            <Link href="/courses" className="inline-flex items-center gap-2 border-b border-secondary pb-1 text-sm font-semibold text-secondary transition hover:gap-3">
              Explore full directory
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>

        <div className="grid grid-cols-2 gap-4 md:gap-6 md:grid-cols-12 md:auto-rows-[minmax(320px,auto)]">
          {departments.map((item, index) => {
            const Icon = item.icon;

            return (
              <Reveal key={item.title} delay={index * 90} variant="soft-zoom" className={item.className}>
                <Link href={item.href} className="block h-full">
                  <article className="stitch-panel stitch-hover-lift group relative h-full overflow-hidden p-6 sm:p-8">
                    <div className="relative flex h-full flex-col justify-between">
                      <div>
                        <span className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl sm:mb-6 sm:h-14 sm:w-14 ${item.accent}`}>
                          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                        </span>
                        <h3 className="text-2xl font-normal italic text-primary sm:text-4xl">{item.title}</h3>
                        <p className="mt-3 max-w-md text-xs leading-6 text-muted-foreground sm:mt-4 sm:text-sm sm:leading-7">
                          {item.description}
                        </p>
                      </div>
                      <div className="mt-8 flex items-center justify-between sm:mt-10">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground sm:text-[11px]">
                          View modules
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-primary transition group-hover:bg-primary group-hover:text-white sm:h-11 sm:w-11">
                          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── FOUNDATIONS ── */}
      <section className="bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <Reveal variant="mask-up" className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-secondary/70">Dual-Pathway System</p>
            <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
              Choose your <span className="italic text-secondary">foundation</span>
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground md:text-lg">
              We offer dual-pathway learning so families can align board structure with future goals.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-2 gap-3 md:gap-8">
            {foundations.map((item, index) => (
              <Reveal key={item.title} delay={index * 100} variant="soft-zoom">
                <article className="stitch-panel group relative h-full overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-28px_rgba(26,28,29,0.22)] sm:p-8 md:p-12">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/25 to-transparent" />
                  <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white sm:px-4 sm:py-1.5 sm:text-[10px]">
                    Board Pathway
                  </span>
                  <h3 className="mt-5 text-xl font-normal italic text-primary sm:mt-8 sm:text-3xl md:text-4xl">{item.title}</h3>
                  <p className="mt-3 text-xs leading-6 text-muted-foreground sm:mt-5 sm:text-sm sm:leading-8">{item.description}</p>
                  <Link href={item.href} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-secondary transition hover:gap-3 sm:mt-10 sm:text-sm">
                    {item.cta}
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIFFERENTIATORS ── */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        <Reveal variant="mask-up" className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-secondary/70">Why Choose STC</p>
          <h2 className="mt-4 text-4xl font-light text-primary sm:text-5xl md:text-6xl">
            The <span className="italic text-secondary">STC difference</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-8">
          {differentiators.map((item, index) => {
            const Icon = item.icon;

            return (
              <Reveal key={item.title} delay={index * 90} variant="fade-up" className="h-full">
                <div className="group relative h-full overflow-hidden rounded-[20px] border border-black/[0.04] bg-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(26,28,29,0.15)] sm:rounded-[24px] sm:p-8 md:p-10">
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${item.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
                  <div className="relative flex h-full flex-col items-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary transition-colors group-hover:bg-white sm:h-14 sm:w-14 sm:rounded-2xl">
                      <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
                    </span>
                    <h3 className="mt-4 text-lg font-normal italic text-primary sm:mt-6 sm:text-2xl md:text-3xl">{item.title}</h3>
                    <p className="mt-3 text-xs leading-6 text-muted-foreground sm:mt-4 sm:text-sm sm:leading-7">{item.copy}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-24 md:px-12 md:pb-32">
        <Reveal variant="soft-zoom">
          <div className="relative mx-auto max-w-[1600px] overflow-hidden rounded-[28px] bg-primary px-8 py-14 md:px-16 md:py-20">
            {/* decorative floating circles */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/[0.03]" />
            <div className="pointer-events-none absolute -bottom-8 left-1/4 h-32 w-32 rounded-full bg-white/[0.04]" />

            <div className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">Next Cohort Starts Soon</p>
                <h2 className="mt-4 text-4xl font-light text-white sm:text-5xl md:text-6xl">
                  Ready to transcend the <span className="italic text-accent">ordinary?</span>
                </h2>
                <p className="mt-6 max-w-xl text-base leading-8 text-white md:text-lg">
                  Join the next cohort with a calmer, sharper academic environment built around long-term progress.
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
