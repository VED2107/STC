import Link from "next/link";
import { BookOpen, Brain, GraduationCap, Users } from "lucide-react";
import { stitchButtonClass, stitchSecondaryButtonClass } from "@/components/stitch/primitives";

const pillars = [
  {
    title: "Academic Rigor",
    icon: BookOpen,
    copy: "Structured progression from foundational classes to board and competitive exam readiness.",
  },
  {
    title: "Mentor-Led Learning",
    icon: Users,
    copy: "Small batches and direct faculty supervision for stronger conceptual clarity.",
  },
  {
    title: "Inquiry First",
    icon: Brain,
    copy: "Question-driven pedagogy designed to build confidence, not rote dependency.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
      <div className="max-w-4xl">
        <p className="stitch-kicker">About STC</p>
        <h1 className="mt-4 text-5xl italic text-primary md:text-7xl">
          Building scholars with calm rigor.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          STC Academy supports learners from Primary to HSC with board-aligned,
          faculty-guided learning systems across GSEB and CBSE pathways.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article key={pillar.title} className="stitch-panel p-8">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-3xl text-primary">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{pillar.copy}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-14 stitch-panel p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-4xl italic text-primary">Start with the right track</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Explore curriculum levels and faculty-backed study plans based on your board and goals.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/online-courses" className={stitchButtonClass}>
              Explore Curriculum
            </Link>
            <Link href="/faculty" className={stitchSecondaryButtonClass}>
              Meet Faculty
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
        <GraduationCap className="h-4 w-4 text-secondary" />
        Admissions guidance available for Primary, SSC, HSC, JEE, and NEET pathways.
      </div>
    </div>
  );
}
