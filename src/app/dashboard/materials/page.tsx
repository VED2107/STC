"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, FolderOpen, PlayCircle, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { getCached, setCache } from "@/lib/dashboard-cache";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchPanelClass,
  stitchPanelSoftClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

interface MaterialRow {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video" | "link";
  file_url: string;
  course?: { title: string } | null;
}

interface StudentAccessRow {
  id: string;
  class_id: string;
  student_type: "tuition" | "online";
  class?: { name?: string } | null;
}

const supabase = createClient();

const typeConfig: Record<string, { icon: typeof FileText; accent: string; label: string }> = {
  pdf: { icon: FileText, accent: "bg-[#fce4ec] text-[#c62828]", label: "PDF Document" },
  video: { icon: PlayCircle, accent: "bg-[#e8f5e9] text-[#2e7d32]", label: "Video Lesson" },
  notes: { icon: StickyNote, accent: "bg-[#eef2ff] text-[#3651a5]", label: "Study Notes" },
  link: { icon: ExternalLink, accent: "bg-[#fff2dc] text-[#9a6500]", label: "External Link" },
};

const materialCardClass = cn(
  stitchPanelClass,
  "group relative overflow-hidden stitch-hover-lift transition hover:border-primary/12"
);

export default function StudentMaterialsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMaterials = useCallback(async () => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }

    const cacheKey = `student:materials:${user.id}`;
    const cached = getCached<{ materials: MaterialRow[]; className: string }>(cacheKey);
    if (cached) {
      setMaterials(cached.materials);
      setClassName(cached.className);
      setLoading(false);
    } else {
      setLoading(true);
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
          .from("materials")
          .select("id, title, type, file_url, course:courses(title)")
          .in("class_id", classIds)
          .order("sort_order");
        data = (response.data as MaterialRow[] | null) ?? [];
      } else {
        data = [];
      }
    }

    const nextMaterials = data ?? [];
    setMaterials(nextMaterials);
    setLoading(false);
    setCache(cacheKey, { materials: nextMaterials, className: (typedStudent.class as { name?: string } | null)?.name ?? "" });
  }, [authLoading, router, user]);

  useEffect(() => {
    void fetchMaterials();
  }, [fetchMaterials]);

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
          {/* Stats summary bar */}
          <div className="mt-8 flex flex-wrap gap-3">
            {Object.entries(
              materials.reduce<Record<string, number>>((acc, m) => {
                acc[m.type] = (acc[m.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => {
              const config = typeConfig[type] ?? typeConfig.pdf;
              const TypeIcon = config.icon;
              return (
                <div key={type} className={cn(stitchPanelSoftClass, "flex items-center gap-3 px-4 py-2")}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.accent}`}>
                    <TypeIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{count}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{type}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {materials.map((material) => {
              const config = typeConfig[material.type] ?? typeConfig.pdf;
              const TypeIcon = config.icon;
              return (
                <a
                  key={material.id}
                  href={material.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className={materialCardClass}
                >
                  {/* Hover gradient overlays */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#f1edff]/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />

                  <div className="relative flex items-center justify-between gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.accent}`}>
                      <TypeIcon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {material.course?.title ?? "Academy Faculty"}
                    </span>
                  </div>
                  <h2 className="relative mt-6 text-2xl font-semibold leading-tight text-foreground md:text-3xl">
                    {material.title}
                  </h2>
                  <p className="relative mt-3 text-sm leading-7 text-muted-foreground">
                    {material.course?.title
                      ? `${config.label} for ${material.course.title}`
                      : config.label}
                  </p>
                  <div className="relative mt-6 flex items-center justify-between border-t border-border/40 pt-4">
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors group-hover:text-primary">
                      <FileText className="h-4 w-4 text-primary" />
                      Open Resource
                    </span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
