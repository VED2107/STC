"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { BookOpen, ImageOff, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchInputClass,
  stitchPanelClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { CourseFormDialog } from "@/components/admin/course-form-dialog";
import type { Course } from "@/lib/types/database";

type CourseRow = Omit<Course, "class" | "teacher"> & {
  class: { name: string; board: string } | null;
  teacher: { name: string } | null;
  teacher_id?: string;
};

function AdminCoursesPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseRow | undefined>();

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setEditingCourse(undefined);
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("courses")
      .select("*, class:classes(name, board), teacher:teachers(name)")
      .order("created_at", { ascending: false });
    setCourses((data as CourseRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role === "teacher") {
      router.push("/admin/attendance");
      return;
    }

    if (role === "admin") {
      void fetchCourses();
      return;
    }

    if (role === "student") {
      router.push("/dashboard");
      return;
    }
  }, [fetchCourses, role, router]);

  useEffect(() => {
    if (role !== "admin") return;
    if (searchParams?.get("create") === "1" && !dialogOpen) {
      setEditingCourse(undefined);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, dialogOpen, router, pathname]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this course?")) return;
    const supabase = createClient();
    await supabase.from("courses").delete().eq("id", id);
    void fetchCourses();
  }

  const filtered = courses.filter((course) => {
    const haystack = `${course.title} ${course.subject}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <StitchSectionHeader
          eyebrow="Curriculum Atelier"
          title="Manage Courses"
          description="Shape the academy's published curriculum, assign scholars, and refine subject pathways for every board and class."
        />
        <div className="flex w-full max-w-xl gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(stitchInputClass, "pl-11")}
              placeholder="Search course titles..."
            />
          </div>
          <button
            type="button"
            className={stitchButtonClass}
            onClick={() => {
              setEditingCourse(undefined);
              setDialogOpen(true);
            }}
          >
            Add Course
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <BookOpen className="h-10 w-10 animate-pulse text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={BookOpen}
            title="No Courses Published"
            description="Add the first curriculum entry to start building the digital atelier."
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <article key={course.id} className={stitchPanelClass}>
              <div className="overflow-hidden rounded-[22px] border border-border">
                {course.thumbnail_url ? (
                  <Image
                    src={course.thumbnail_url}
                    alt={course.title}
                    width={400}
                    height={472}
                    className="aspect-[1.18] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[1.18] w-full items-center justify-center bg-muted text-muted-foreground">
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                      <ImageOff className="h-4 w-4" />
                      No Thumbnail Uploaded
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="stitch-pill border-primary/10 bg-primary/10 px-3 py-1 text-[10px] text-primary">
                  {course.class?.board ?? "STC"}
                </span>
                <span className="stitch-pill px-3 py-1 text-[10px]">
                  {course.class?.name ?? "Independent"}
                </span>
              </div>
              <h2 className="mt-5 text-4xl leading-tight text-foreground">{course.title}</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{course.description}</p>
              <div className="mt-6 text-sm text-muted-foreground">
                <p>Subject: {course.subject}</p>
                <p className="mt-2">Teacher: {course.teacher?.name ?? "Unassigned"}</p>
                <p className="mt-2">Fee: INR {Number(course.fee_inr ?? 0).toLocaleString("en-IN")}</p>
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  className={stitchButtonClass}
                  onClick={() => {
                    setEditingCourse(course);
                    setDialogOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-full border border-destructive/20 px-5 py-3 text-sm text-destructive transition hover:bg-destructive/10"
                  onClick={() => void handleDelete(course.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <CourseFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={fetchCourses}
        editCourse={editingCourse as (Partial<Course> & { id?: string }) | undefined}
      />
    </div>
  );
}

export default function AdminCoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <BookOpen className="h-10 w-10 animate-pulse text-primary" />
        </div>
      }
    >
      <AdminCoursesPageInner />
    </Suspense>
  );
}
