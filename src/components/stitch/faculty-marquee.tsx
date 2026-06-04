"use client";

import Link from "next/link";
import { ArrowUpRight, GraduationCap } from "lucide-react";

interface FacultyTeacher {
  id: string;
  name: string;
  subject: string;
  qualification: string;
}

const accents = [
  { bg: "from-[#d0e9d4]/60 to-[#d0e9d4]/20", avatar: "bg-[#d0e9d4]/55 text-[#374c3d]", pill: "bg-[#d0e9d4]/40 text-[#374c3d]" },
  { bg: "from-[#eef2ff]/80 to-[#eef2ff]/30", avatar: "bg-[#eef2ff] text-[#3651a5]", pill: "bg-[#eef2ff] text-[#3651a5]" },
  { bg: "from-[#fff2dc]/70 to-[#fff2dc]/25", avatar: "bg-[#fff2dc] text-[#9a6500]", pill: "bg-[#fff2dc] text-[#9a6500]" },
  { bg: "from-[#f7edf1]/70 to-[#f7edf1]/25", avatar: "bg-[#f7edf1] text-[#9a4767]", pill: "bg-[#f7edf1] text-[#9a4767]" },
  { bg: "from-[#f1edff]/70 to-[#f1edff]/25", avatar: "bg-[#f1edff] text-[#6a4bc4]", pill: "bg-[#f1edff] text-[#6a4bc4]" },
  { bg: "from-[#e8f4f8]/70 to-[#e8f4f8]/25", avatar: "bg-[#e8f4f8] text-[#2a6f7f]", pill: "bg-[#e8f4f8] text-[#2a6f7f]" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function FacultyCard({
  teacher,
  index,
}: {
  teacher: FacultyTeacher;
  index: number;
}) {
  const accent = accents[index % accents.length];

  return (
    <Link
      href="/faculty"
      className="group relative flex w-[300px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-[24px] border border-black/[0.04] bg-white p-6 transition-all duration-400 hover:-translate-y-1.5 hover:border-primary/15 hover:shadow-[0_20px_50px_-16px_rgba(26,28,29,0.18)] sm:w-[320px]"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.bg} opacity-0 transition-opacity duration-400 group-hover:opacity-100`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />

      <div className="relative flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-bold tracking-tight transition-transform duration-300 group-hover:scale-105 ${accent.avatar}`}>
            {getInitials(teacher.name)}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-lg font-medium italic text-foreground transition-colors group-hover:text-primary">
              {teacher.name}
            </p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${accent.pill}`}>
              {teacher.subject}
            </span>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:text-secondary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      <div className="relative mt-5 flex items-center gap-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 transition-colors group-hover:bg-white/70">
        <GraduationCap className="h-4 w-4 shrink-0 text-secondary/60" />
        <p className="truncate text-xs font-medium text-muted-foreground">
          {teacher.qualification}
        </p>
      </div>
    </Link>
  );
}

export function FacultyMarquee({ teachers }: { teachers: FacultyTeacher[] }) {
  if (teachers.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <div className="rounded-[20px] border border-black/5 bg-white/80 px-6 py-8 text-center text-sm text-muted-foreground">
          No faculty profiles added yet.
        </div>
      </div>
    );
  }

  if (teachers.length <= 3) {
    return (
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <div className="flex flex-wrap justify-center gap-4">
          {teachers.map((teacher, i) => (
            <FacultyCard key={teacher.id} teacher={teacher} index={i} />
          ))}
        </div>
      </div>
    );
  }

  const trackA = [...teachers];
  const trackB = [...teachers];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-muted to-transparent md:w-36" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-muted to-transparent md:w-36" />

      <div className="flex w-max animate-marquee gap-5 hover:[animation-play-state:paused]">
        {trackA.map((teacher, i) => (
          <FacultyCard
            key={`a-${teacher.id}-${i}`}
            teacher={teacher}
            index={i}
          />
        ))}
        {trackB.map((teacher, i) => (
          <FacultyCard
            key={`b-${teacher.id}-${i}`}
            teacher={teacher}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
