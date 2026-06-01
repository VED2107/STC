"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

interface FacultyTeacher {
  id: string;
  name: string;
  subject: string;
  qualification: string;
}

const accents = [
  "from-[#d0e9d4]/60 to-[#d0e9d4]/20",
  "from-[#eef2ff]/80 to-[#eef2ff]/30",
  "from-[#fff2dc]/70 to-[#fff2dc]/25",
  "from-[#f7edf1]/70 to-[#f7edf1]/25",
  "from-[#f1edff]/70 to-[#f1edff]/25",
  "from-[#e8f4f8]/70 to-[#e8f4f8]/25",
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
      className="group relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-black/[0.04] bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/15 hover:shadow-[0_16px_40px_-16px_rgba(26,28,29,0.14)] sm:w-[300px]"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/15 to-transparent" />

      <div className="relative flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-sm font-semibold text-primary transition-colors group-hover:bg-primary/12">
          {getInitials(teacher.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-foreground transition-colors group-hover:text-primary">
            {teacher.name}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {teacher.subject}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 border-t border-black/[0.04] pt-3">
        <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <p className="truncate text-xs text-muted-foreground/80">
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
