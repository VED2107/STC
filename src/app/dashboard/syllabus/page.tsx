"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

interface SyllabusUnit {
  title: string;
  topics: string[];
}

interface SyllabusRow {
  id: string;
  subject: string;
  content: { units?: SyllabusUnit[] };
  class?: { name: string } | null;
}

interface StudentAccessRow {
  id: string;
  class_id: string;
  student_type: "tuition" | "online";
}

export default function StudentSyllabusPage() {
  const router = useRouter();
  const supabase = createClient();
  const [syllabi, setSyllabi] = useState<SyllabusRow[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSyllabi = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: student } = await supabase
      .from("students")
      .select("id, class_id, student_type")
      .eq("profile_id", user.id)
      .single();

    if (!student) {
      setLoading(false);
      return;
    }

    const typedStudent = student as StudentAccessRow;

    let data: SyllabusRow[] | null = null;

    if (typedStudent.student_type === "tuition") {
      const response = await supabase
        .from("syllabus")
        .select("id, subject, content, class:classes(name)")
        .eq("class_id", typedStudent.class_id)
        .order("subject");
      data = (response.data as SyllabusRow[] | null) ?? [];
    } else {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course:courses(class_id)")
        .eq("student_id", typedStudent.id)
        .eq("status", "active");

      const classIds = Array.from(
        new Set(
          ((enrollments as { course?: { class_id?: string } | null }[] | null) ?? [])
            .map((row) => row.course?.class_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      if (classIds.length > 0) {
        const response = await supabase
          .from("syllabus")
          .select("id, subject, content, class:classes(name)")
          .in("class_id", classIds)
          .order("subject");
        data = (response.data as SyllabusRow[] | null) ?? [];
      } else {
        data = [];
      }
    }

    const rows = data ?? [];
    setSyllabi(rows);
    setClassName(rows[0]?.class?.name ?? "");
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void fetchSyllabi();
  }, [fetchSyllabi]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Class Curriculum"
        title={className || "Syllabus Overview"}
        description="Review the published subject roadmap and unit structure for your class."
      />

      {syllabi.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={BookOpen}
            title="No Syllabus Published"
            description="No syllabus is available for your class yet. The atelier will publish the modular roadmap here."
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className={cn(stitchPanelClass, "self-start")}>
            <p className="stitch-kicker">Course Modules</p>
            <div className="mt-5 grid gap-2">
              {syllabi.map((syllabus, index) => (
                <div
                  key={syllabus.id}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    index === 0
                      ? "bg-primary/10 text-primary"
                      : "bg-white/3 text-muted-foreground"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}. {syllabus.subject}
                </div>
              ))}
            </div>
          </aside>

          <div className="space-y-8">
            {syllabi.map((syllabus, index) => (
              <section key={syllabus.id}>
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                      index === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-[#163241] text-[#9db7c5]"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-4xl text-foreground">{syllabus.subject}</h2>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {(syllabus.content.units ?? []).map((unit, unitIndex) => (
                    <article key={unit.title + unitIndex} className={stitchPanelClass}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="stitch-kicker">Chapter {unitIndex + 1}</p>
                          <h3 className="mt-4 text-3xl text-foreground">{unit.title}</h3>
                        </div>
                        <span className="stitch-pill px-3 py-1 text-[10px]">
                          {unitIndex === 0 ? "Current Study" : "Reading"}
                        </span>
                      </div>
                      <div className="mt-5 space-y-3">
                        {unit.topics.slice(0, 4).map((topic) => (
                          <div
                            key={topic}
                            className="flex items-start gap-3 text-sm leading-7 text-muted-foreground"
                          >
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary" />
                            <span>{topic}</span>
                          </div>
                        ))}
                      </div>
                      {unitIndex === 0 ? (
                        <button type="button" className={cn(stitchButtonClass, "mt-8")}>
                          Continue Reading
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}

          </div>
        </div>
      )}
    </div>
  );
}
