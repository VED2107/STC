import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Building2, Flame, GraduationCap, Microscope, Sparkles } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import { HeroMedia } from "@/components/stitch/hero-media";

const stats = [
  { value: "98%", label: "Placement Rate" },
  { value: "12:1", label: "Student-Teacher Ratio" },
  { value: "15k+", label: "Alumni Network" },
  { value: "45", label: "Global Partners" },
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
    href: "/courses?level=hsc&track=jee",
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
  },
  {
    title: "Peer Mentorship",
    copy: "Small-batch learning creates accountability, community, and focused academic support.",
    icon: Sparkles,
  },
  {
    title: "Inquiry First",
    copy: "We prioritize questions, discussion, and conceptual confidence before speed-drill patterns.",
    icon: Brain,
  },
];

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      <section className="relative overflow-hidden bg-muted">
        <HeroMedia />
        <div className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
          <div className="max-w-5xl md:pl-[8%]">
            <Reveal variant="fade">
              <div className="inline-flex items-center rounded-full border border-black/[0.08] bg-white/80 px-4 py-1.5 backdrop-blur-sm">
                <span className="mr-3 h-2 w-2 rounded-full bg-secondary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Autumn Enrollment Open
                </span>
              </div>
            </Reveal>

            <Reveal delay={100} variant="mask-up">
              <h1 className="mt-8 max-w-5xl text-6xl font-light leading-[1.04] text-primary md:text-8xl">
                Cultivating the
                <br />
                <span className="italic">Intellect of Tomorrow.</span>
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-8 max-w-2xl text-xl font-light leading-relaxed text-muted-foreground md:text-2xl">
                High-quality teaching, trusted study materials, and strong conceptual learning
                for students across Gujarat&apos;s most important academic milestones.
              </p>
            </Reveal>

            <Reveal delay={280} variant="soft-zoom">
              <div className="mt-12 flex flex-col gap-5 sm:flex-row">
                <Link href="/about-us" className="rounded-xl bg-primary px-10 py-5 text-center text-lg font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-105">
                  Begin Your Inquiry
                </Link>
                <Link href="/courses" className="rounded-xl bg-accent px-10 py-5 text-center text-lg font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:brightness-105">
                  View Curriculum
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-10 px-6 text-center md:grid-cols-4 md:px-12">
          {stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 80} variant="fade-up">
              <div className="text-5xl text-primary">{stat.value}</div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {stat.label}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <Reveal variant="mask-up" className="max-w-2xl">
            <h2 className="text-5xl font-light leading-tight text-primary md:text-6xl">
              Academic departments for the <span className="italic text-secondary">Modern Scholar</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Each academic path is designed to build clear concepts, strong practice habits,
              and confident exam performance.
            </p>
          </Reveal>
          <Reveal delay={120} variant="fade">
            <Link href="/courses" className="inline-flex items-center gap-2 border-b border-secondary pb-1 text-sm font-semibold text-secondary">
              Explore full directory
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:auto-rows-[minmax(320px,auto)]">
          {departments.map((item, index) => {
            const Icon = item.icon;

            return (
              <Reveal key={item.title} delay={index * 90} variant="soft-zoom" className={item.className}>
                <Link href={item.href} className="block h-full">
                  <article className="stitch-panel h-full p-8 transition hover:-translate-y-1">
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <span className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl ${item.accent}`}>
                          <Icon className="h-7 w-7" />
                        </span>
                        <h3 className="text-4xl font-normal italic text-primary">{item.title}</h3>
                        <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <div className="mt-10 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          View modules
                        </span>
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-primary transition hover:bg-accent hover:text-accent-foreground">
                          <ArrowRight className="h-4 w-4" />
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

      <section className="bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <Reveal variant="mask-up" className="mx-auto max-w-3xl text-center">
            <h2 className="text-5xl font-light text-primary md:text-6xl">
              Choose your <span className="italic text-secondary">foundation</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              We offer dual-pathway learning so families can align board structure with future goals.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {foundations.map((item, index) => (
              <Reveal key={item.title} delay={index * 100} variant="soft-zoom">
                <article className="stitch-panel h-full p-10 md:p-12">
                  <span className="inline-flex rounded-full bg-primary px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                    Board Pathway
                  </span>
                  <h3 className="mt-8 text-4xl font-normal italic text-primary">{item.title}</h3>
                  <p className="mt-5 text-base leading-8 text-muted-foreground">{item.description}</p>
                  <Link href={item.href} className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-secondary">
                    {item.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        <Reveal variant="mask-up">
          <h2 className="text-5xl font-light text-primary md:text-6xl">
            The <span className="italic text-secondary">STC difference</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {differentiators.map((item, index) => {
            const Icon = item.icon;

            return (
              <Reveal key={item.title} delay={index * 90} variant="fade-up" className="space-y-5">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary stitch-ghost-border">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="text-3xl font-normal italic text-primary">{item.title}</h3>
                <p className="max-w-sm text-sm leading-7 text-muted-foreground">{item.copy}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="px-6 pb-24 md:px-12 md:pb-32">
        <Reveal variant="soft-zoom">
          <div className="mx-auto max-w-[1600px] overflow-hidden rounded-[28px] bg-primary px-8 py-14 md:px-16 md:py-20">
            <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-5xl font-light text-white md:text-6xl">
                  Ready to transcend the <span className="italic text-accent">ordinary?</span>
                </h2>
                <p className="mt-6 text-lg leading-8 text-white/72">
                  Join the next cohort with a calmer, sharper academic environment built around long-term progress.
                </p>
              </div>
              <Link href="/login" className="rounded-xl bg-accent px-10 py-5 text-center text-lg font-semibold text-accent-foreground transition hover:brightness-105">
                Begin Application
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
