"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchPanelClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

interface SyllabusRow {
  id: string;
  class_id: string;
  subject: string;
  class?: { name: string } | null;
}

interface MaterialRow {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video" | "link";
  file_url: string;
  subject: string;
  class_id: string;
}

interface StudentAccessRow {
  id: string;
  class_id: string;
  student_type: "tuition" | "online";
}

const supabase = createClient();

export default function StudentSyllabusPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [syllabi, setSyllabi] = useState<SyllabusRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);

  const materialMap = useMemo(() => {
    return materials.reduce<Record<string, MaterialRow[]>>((accumulator, item) => {
      const key = `${item.class_id}::${item.subject.toLowerCase()}`;
      const existing = accumulator[key] ?? [];
      existing.push(item);
      accumulator[key] = existing;
      return accumulator;
    }, {});
  }, [materials]);

  const fetchSyllabi = useCallback(async () => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
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
    let classIds: string[] = [];

    if (typedStudent.student_type === "tuition") {
      classIds = [typedStudent.class_id];
      const response = await supabase
        .from("syllabus")
        .select("id, class_id, subject, class:classes(name)")
        .eq("class_id", typedStudent.class_id)
        .order("subject");
      data = (response.data as SyllabusRow[] | null) ?? [];
    } else {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course:courses(class_id)")
        .eq("student_id", typedStudent.id)
        .eq("status", "active");

      classIds = Array.from(
        new Set(
          ((enrollments as { course?: { class_id?: string } | null }[] | null) ?? [])
            .map((row) => row.course?.class_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      if (classIds.length > 0) {
        const response = await supabase
          .from("syllabus")
          .select("id, class_id, subject, class:classes(name)")
          .in("class_id", classIds)
          .order("subject");
        data = (response.data as SyllabusRow[] | null) ?? [];
      } else {
        data = [];
      }
    }

    let materialRows: MaterialRow[] = [];
    if (classIds.length > 0) {
      const { data: materialData } = await supabase
        .from("materials")
        .select("id, title, type, file_url, subject, class_id")
        .in("class_id", classIds)
        .order("sort_order");
      materialRows = (materialData as MaterialRow[] | null) ?? [];
    }

    const rows = data ?? [];
    setSyllabi(rows);
    setMaterials(materialRows);
    setClassName(rows[0]?.class?.name ?? "");
    setLoading(false);
  }, [authLoading, router, user]);

  useEffect(() => {
    void fetchSyllabi();
  }, [fetchSyllabi]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Class Curriculum"
        title={className || "Syllabus Overview"}
        description="Review the published subjects and all linked materials for your class."
      />

      {syllabi.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={BookOpen}
            title="No Syllabus Published"
            description="No syllabus is available for your class yet. The atelier will publish the roadmap here."
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className={cn(stitchPanelClass, "self-start")}>
            <p className="stitch-kicker">Subjects</p>
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
            {syllabi.map((syllabus, index) => {
              const linkedMaterials = materialMap[`${syllabus.class_id}::${syllabus.subject.toLowerCase()}`] ?? [];

              return (
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    {linkedMaterials.length > 0 ? linkedMaterials.map((material) => (
                      <a
                        key={material.id}
                        href={material.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(stitchPanelClass, "transition hover:border-primary/12")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="stitch-pill border-primary/10 bg-primary/10 px-3 py-1 text-[10px] text-primary">
                            {material.type}
                          </span>
                          {material.type === "video" ? (
                            <PlayCircle className="h-4 w-4 text-primary" />
                          ) : (
                            <FileText className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <h3 className="mt-8 text-3xl leading-tight text-foreground">{material.title}</h3>
                        <p className="mt-4 text-sm leading-7 text-muted-foreground">
                          Linked study material for this subject.
                        </p>
                        <div className="mt-8 flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4 text-primary" />
                            Open Resource
                          </span>
                          <ExternalLink className="h-4 w-4 text-primary" />
                        </div>
                      </a>
                    )) : (
                      <div className={stitchPanelClass}>
                        <p className="text-sm text-muted-foreground">
                          No materials have been linked to this subject yet.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
