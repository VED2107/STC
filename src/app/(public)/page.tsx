import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/stitch/reveal";
import { FacultyMarquee } from "@/components/stitch/faculty-marquee";
import { StepwellJourney } from "@/components/stitch/stepwell-journey";
import { SunStairs } from "@/components/stitch/sun-stairs";
import { createClient } from "@/lib/supabase/server";
import { FaqJsonLd, type FaqItem } from "@/components/seo/json-ld";
import { stitchButtonClass, stitchOutlineButtonClass } from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "STC Academy | CBSE & GSEB Tuition Classes in Patan, Gujarat",
  description: "STC Academy (Saraswati Tuition Classes) provides expert coaching for Primary to HSC students in CBSE and GSEB boards, in Patan, Gujarat. Trusted study materials and strong conceptual learning.",
  keywords: ["STC Academy", "tuition centre", "Patan Gujarat tuition", "Gujarat education", "CBSE", "GSEB", "SSC", "HSC", "JEE", "NEET", "online courses"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "STC Academy | CBSE & GSEB Tuition Classes in Patan, Gujarat",
    description: "Expert coaching for Primary to HSC students in CBSE and GSEB boards. Trusted study materials and strong conceptual learning.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "STC Academy | CBSE & GSEB Tuition Classes in Patan, Gujarat",
    description: "Expert coaching for Primary to HSC students in CBSE and GSEB boards. Trusted study materials and strong conceptual learning.",
  },
};

const faqs: FaqItem[] = [
  {
    question: "Which boards do you teach?",
    answer:
      "STC Academy provides coaching for both CBSE and GSEB students. We offer tuition from Primary to HSC, covering Science and Commerce streams with subject-focused guidance.",
  },
  {
    question: "Do you offer a demo lecture?",
    answer:
      "Yes. We offer a demo lecture so students and parents can experience our teaching methodology before enrolling. Contact us to schedule your demo class.",
  },
  {
    question: "What are your fees?",
    answer:
      "Our fee structure varies depending on the student's class, board, subjects, and course duration. Contact STC Academy for the latest fee details and available batches.",
  },
  {
    question: "Are study materials included?",
    answer:
      "Yes. Students receive well-structured study materials, practice worksheets, assignments, and regular tests designed to strengthen concepts and improve exam performance.",
  },
  {
    question: "What are your class timings?",
    answer:
      "Classes are conducted Monday to Saturday, with multiple batches available between 6:00 AM and 8:00 PM. Batch timings are scheduled according to the student's class and course.",
  },
  {
    question: "Why should I choose STC Academy?",
    answer:
      "STC Academy focuses on conceptual learning, personalized attention, experienced faculty, regular assessments, and exam-oriented preparation. Our goal is to help every student build confidence, improve academic performance, and achieve long-term success.",
  },
];

export const revalidate = 300;

type HomeTeacherRow = {
  id: string;
  name: string;
  subject: string;
  qualification: string;
};

const headline = "From Class 1 to JEE and NEET, one step at a time.";

// The real class ladder, drawn as the steps of a stepwell. Each step is taller than the last.
const steps = [
  { title: "Primary", range: "Classes 1 to 5", href: "/online-courses?level=primary" },
  { title: "Middle", range: "Classes 6 to 8", href: "/online-courses?level=middle" },
  { title: "SSC", range: "Board preparation", href: "/online-courses?level=ssc" },
  { title: "11th and HSC", range: "Science and Commerce", href: "/online-courses?level=hsc" },
  { title: "JEE and NEET", range: "Entrance preparation", href: "/online-courses?level=hsc" },
];

const boards = [
  {
    title: "CBSE",
    description: "Concept-first teaching in line with the national curriculum, with logic-led problem solving that also serves competitive exams.",
  },
  {
    title: "GSEB",
    description: "Gujarat board preparation with local context, mentoring, and a strong focus on the exam pattern.",
  },
];

const approach = [
  {
    title: "Material edited for clarity",
    copy: "Every module is edited for clarity, sequencing, and retention rather than volume alone.",
  },
  {
    title: "Small batches",
    copy: "Small-batch learning creates accountability, community, and focused academic support.",
  },
  {
    title: "Questions come first",
    copy: "We prioritize questions, discussion, and conceptual confidence before speed-drill patterns.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const [teacherCountRes, courseCountRes, materialCountRes, teachersRes] = await Promise.all([
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_online_only", true).eq("is_active", true),
    supabase.from("materials").select("id", { count: "exact", head: true }),
    supabase.from("teachers").select("id, name, subject, qualification").order("created_at", { ascending: false }).limit(6),
  ]);

  // Live counts from the database. A count with nothing to show is left out.
  const stats = [
    { value: teacherCountRes.count ?? 0, label: "teachers" },
    { value: courseCountRes.count ?? 0, label: "online subjects" },
    { value: materialCountRes.count ?? 0, label: "study materials" },
  ].filter((stat) => stat.value > 0);
  const latestTeachers = (teachersRes.data as HomeTeacherRow[] | null) ?? [];

  return (
    <>
      <section className="relative overflow-hidden bg-background text-primary">
        {/* On phones the sun rests behind the headline. On desktop it lives on the stairs. */}
        <span aria-hidden="true" className="dawn pointer-events-none absolute inset-0 hidden lg:block" />
        <span aria-hidden="true" className="sun-rise-box absolute -top-10 -right-14 size-44 rounded-full bg-accent lg:hidden" />
        <div className="relative mx-auto max-w-[1280px] px-4 pt-12 md:px-8 lg:pt-16">
          <div className="relative z-10 max-w-3xl">
            <p className="text-base font-medium text-secondary">Saraswati Tuition Classes, teaching in Patan since 2010</p>
            <h1 aria-label={headline} className="mt-3 text-[2.75rem] leading-[1.02] font-extrabold md:text-6xl lg:text-[5.25rem]">
              {headline.split(" ").map((word, index) => (
                <span key={`${word}-${index}`} aria-hidden="true">
                  <span className="mask-word">
                    <span style={{ "--w": index } as React.CSSProperties}>{word}</span>
                  </span>{" "}
                </span>
              ))}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              CBSE and GSEB tuition with clear teaching, trusted study materials, and regular tests. Admissions for 2026 are open.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/enroll" className={cn(stitchButtonClass, "min-h-12 px-6 text-base")}>
                Enroll now
              </Link>
              <Link
                href="/online-courses"
                className={cn(stitchOutlineButtonClass, "min-h-12 px-6 text-base")}
              >
                Browse online courses
              </Link>
            </div>
          </div>

        </div>
        <SunStairs steps={steps} />
      </section>

      {stats.length > 0 ? (
        <section aria-label="STC Academy in numbers" className="mx-auto max-w-[1280px] px-4 pt-12 md:px-8">
          <dl className="flex flex-wrap gap-x-14 gap-y-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <dd className="tnum text-4xl font-bold text-primary">{stat.value.toLocaleString("en-IN")}</dd>
                <dt className="text-muted-foreground">{stat.value === 1 ? stat.label.replace(/s$/, "") : stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <StepwellJourney />

      <section aria-labelledby="boards" className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 lg:py-32">
        <Reveal>
          <h2 id="boards" className="max-w-2xl text-3xl text-primary md:text-5xl">Two boards, one way of teaching</h2>
        </Reveal>
        <div className="mt-10 grid gap-x-12 gap-y-10 md:mt-16 md:grid-cols-2">
          {boards.map((board, index) => (
            <Reveal key={board.title} delay={index * 80}>
              <Link href="/online-courses" className="group block">
                <h3 className="flex items-baseline gap-3 text-7xl font-extrabold tracking-tight text-primary lg:text-[9rem] lg:leading-none">
                  {board.title}
                  <span aria-hidden="true" className="size-4 rounded-full bg-accent transition-transform duration-(--duration-base) ease-(--ease-out) group-hover:scale-150 lg:size-6" />
                </h3>
                <p className="mt-4 max-w-md text-lg leading-8 text-muted-foreground">{board.description}</p>
                <span className="mt-3 inline-block font-semibold text-secondary underline-offset-4 group-hover:underline">
                  See {board.title} courses
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="approach" className="bg-gold-50">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-20 md:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-32">
          <Reveal>
            <h2 id="approach" className="text-3xl text-primary md:text-5xl">How we teach</h2>
          </Reveal>
          <ul>
            {approach.map((item, index) => (
              <Reveal key={item.title} delay={index * 80}>
                <li className="border-t border-gold-300 py-6">
                  <h3 className="text-2xl text-primary md:text-3xl">{item.title}</h3>
                  <p className="mt-2 max-w-xl text-lg leading-8 text-muted-foreground">{item.copy}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="teachers" className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 lg:py-32">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 id="teachers" className="text-3xl text-primary md:text-5xl">Your teachers</h2>
          <Link href="/faculty" className="font-semibold text-secondary underline-offset-4 hover:underline">Meet all faculty</Link>
        </Reveal>
        <FacultyMarquee teachers={latestTeachers} />
      </section>

      <section aria-labelledby="faq" className="mx-auto grid max-w-[1280px] gap-10 px-4 pb-20 md:px-8 lg:grid-cols-[1fr_1.6fr] lg:pb-32">
        <FaqJsonLd items={faqs} />
        <Reveal>
          <h2 id="faq" className="text-3xl text-primary md:text-5xl">Questions parents ask</h2>
        </Reveal>
        <div className="divide-y border-y">
          {faqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) ease-(--ease-out) group-open:rotate-180" />
              </summary>
              <p className="max-w-2xl pb-5 leading-7 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="visit" className="relative overflow-hidden bg-accent text-primary">
        <div className="relative z-10 mx-auto max-w-[1280px] px-4 pt-20 pb-36 md:px-8 lg:pt-28 lg:pb-52">
          <Reveal>
            <h2 id="visit" className="max-w-3xl text-5xl font-extrabold leading-[1.03] lg:text-7xl">Come and sit in on a demo lecture.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8">Call us to arrange a demo and to ask about batches and fees for your child&apos;s class.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="tel:7016072398" className={cn(stitchButtonClass, "min-h-12 px-6 text-base")}>Call 7016072398</a>
              <Link href="/enroll" className="stitch-press no-sun inline-flex min-h-12 items-center justify-center rounded-lg border border-primary px-6 text-base font-semibold transition-colors duration-(--duration-fast) hover:bg-primary hover:text-primary-foreground">
                Enroll online
              </Link>
            </div>
          </Reveal>
        </div>
        {/* The stairs come back, in the colour of the footer below. */}
        <svg viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 w-full lg:h-40">
          <path d="M0 120v-24h200V72h200V48h200V24h200V0h200v120z" fill="var(--surface-low)" />
        </svg>
      </section>
    </>
  );
}
