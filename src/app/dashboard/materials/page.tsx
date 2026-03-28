"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, FolderOpen, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchPanelClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

interface MaterialRow {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video";
  file_url: string;
  course?: { title: string } | null;
}

interface StudentAccessRow {
  id: string;
  class_id: string;
  student_type: "tuition" | "online";
  class?: { name?: string } | null;
}

export default function StudentMaterialsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: student } = await supabase
      .from("students")
      .select("id, class_id, student_type, class:classes(name)")
      .eq("profile_id", user.id)
      .single();

    if (!student) {
      setLoading(false);
      return;
    }

    const typedStudent = student as StudentAccessRow;
    setClassName((typedStudent.class as { name?: string } | null)?.name ?? "");

    let data: MaterialRow[] | null = null;

    if (typedStudent.student_type === "tuition") {
      const response = await supabase
        .from("materials")
        .select("id, title, type, file_url, course:courses(title)")
        .eq("class_id", typedStudent.class_id)
        .order("sort_order");
      data = (response.data as MaterialRow[] | null) ?? [];
    } else {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", typedStudent.id)
        .eq("status", "active");
      const courseIds = ((enrollments as { course_id: string }[] | null) ?? []).map((row) => row.course_id);

      if (courseIds.length > 0) {
        const response = await supabase
          .from("materials")
          .select("id, title, type, file_url, course:courses(title)")
          .in("course_id", courseIds)
          .order("sort_order");
        data = (response.data as MaterialRow[] | null) ?? [];
      } else {
        data = [];
      }
    }

    setMaterials(data ?? []);
    setLoading(false);
  }, [authLoading, router, user]);

  useEffect(() => {
    void fetchMaterials();
  }, [fetchMaterials]);

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
        eyebrow="Class Library"
        title="Academic Resources"
        description={
          className
            ? `Published materials available for ${className} or your purchased courses.`
            : "Published materials available based on your class or purchased courses."
        }
      />

      {materials.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={FolderOpen}
            title="No Academic Resources"
            description="No materials are available for your class yet. The library will populate once the atelier publishes them."
          />
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-6 xl:grid-cols-3">
            {materials.map((material) => (
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
                  <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {material.course?.title ?? "Academy Faculty"}
                  </span>
                </div>
                <h2 className="mt-8 text-4xl leading-tight text-foreground">
                  {material.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  Curated study material published through the STC academic
                  library for focused self-paced mastery.
                </p>
                <div className="mt-8 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    Open Resource
                  </span>
                  <ExternalLink className="h-4 w-4 text-primary" />
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
