"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { confirmAction } from "@/components/ui/feedback";
import { useCallback, useEffect, useState, useMemo } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  BookOpen,
  RefreshCw,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  StitchEmptyState,
  stitchButtonClass,
  stitchInputClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const CourseFormDialog = dynamic(() => import("@/components/admin/course-form-dialog").then(mod => ({ default: mod.CourseFormDialog })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div></div>
});
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";
import { invalidateAfterCourseMutation } from "@/lib/cache-invalidation";
import type { Course } from "@/lib/types/database";

type CourseRow = Omit<Course, "class" | "teacher"> & {
  class: { name: string; board: string } | null;
};

const supabase = createClient();
const COURSES_CACHE_KEY = "admin:courses";

function AdminCoursesPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>(
    () => getAdminPageCache<CourseRow[]>(COURSES_CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(() => getAdminPageCache<CourseRow[]>(COURSES_CACHE_KEY) === null);
  const [search, setSearch] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
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
    const cachedCourses = getAdminPageStorageCache<CourseRow[]>(COURSES_CACHE_KEY);
    if (cachedCourses) {
      setCourses(cachedCourses);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const { data } = await supabase
      .from("courses")
      .select("*, class:classes(name, board)")
      .eq("is_online_only", true)
      .order("created_at", { ascending: false });
    const nextCourses = (data as CourseRow[] | null) ?? [];

    // Optimized subject extraction with better performance
    const subjectSet = new Set<string>();
    for (const course of nextCourses) {
      const subject = course.subject?.trim();
      if (subject) {
        subjectSet.add(subject);
      }
    }
    const nextSubjects = Array.from(subjectSet).sort((a, b) => a.localeCompare(b));

    setCourses(nextCourses);
    setSubjectOptions(nextSubjects);
    setAdminPageCache(COURSES_CACHE_KEY, nextCourses);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (role === "teacher") {
      router.push("/admin/attendance");
      return;
    }

    if (role === "admin" || role === "super_admin") {
      void fetchCourses();
      return;
    }

    if (role === "student") {
      router.push("/dashboard");
      return;
    }
  }, [fetchCourses, role, router, authLoading]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    if (searchParams?.get("create") === "1" && !dialogOpen) {
      setEditingCourse(undefined);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, dialogOpen, router, pathname]);

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirmAction({ title: "Delete this subject?", description: "This cannot be undone.", confirmLabel: "Delete subject", destructive: true }))) return;
    await supabase.from("courses").delete().eq("id", id);
    invalidateAfterCourseMutation();
    void fetchCourses();
  }, [fetchCourses]);

  // Memoized filtered courses for better performance
  const filtered = useMemo(() => {
    let result = courses;

    if (selectedSubject) {
      result = result.filter(course =>
        course.subject.trim().toLowerCase() === selectedSubject.toLowerCase()
      );
    }

    if (search.trim()) {
      const searchTerm = search.toLowerCase();
      result = result.filter((course) => {
        const haystack = `${course.title} ${course.subject}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }

    return result;
  }, [courses, selectedSubject, search]);

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-primary md:text-4xl">Subjects</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">Online subjects students can buy. The class label is for display only and does not grant tuition access.</p>
        </div>
        <button
          type="button"
          className={stitchButtonClass}
          onClick={() => {
            setEditingCourse(undefined);
            setDialogOpen(true);
          }}
        >
          Add subject
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 md:max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search subjects"
            className={cn(stitchInputClass, "pl-9")}
            placeholder="Search subjects"
          />
        </div>
        <button
          type="button"
          aria-label="Reload subjects"
          title="Reload subjects"
          className="flex size-10 items-center justify-center rounded-lg border border-input bg-card transition-colors duration-(--duration-fast) hover:bg-muted disabled:opacity-60"
          onClick={() => {
            setSelectedSubject("");
            void fetchCourses();
          }}
          disabled={loading}
        >
          <RefreshCw aria-hidden="true" className={cn("h-4 w-4", loading ? "animate-spin motion-reduce:animate-none" : "")} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "stitch-press min-h-9 rounded-lg border px-3 text-sm font-medium transition-colors duration-(--duration-fast)",
            !selectedSubject
              ? "border-accent bg-gold-100 text-primary"
              : "border-border bg-background text-foreground hover:bg-muted",
          )}
          onClick={() => setSelectedSubject("")}
        >
          All subjects
        </button>
        {subjectOptions.map((subject) => {
          const active = selectedSubject.toLowerCase() === subject.toLowerCase();

          return (
            <button
              key={subject}
              type="button"
              className={cn(
                "stitch-press min-h-9 rounded-lg border px-3 text-sm font-medium transition-colors duration-(--duration-fast)",
                active
                  ? "border-accent bg-gold-100 text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
              onClick={() => setSelectedSubject(subject)}
            >
              {subject}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={BookOpen}
            title="No online subjects yet"
            description="Add a subject and it will appear in the online course catalogue."
          />
        </div>
      ) : (
        <ul className="rise-in mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <li key={course.id} className="stitch-panel stitch-hover-lift flex flex-col overflow-hidden">
              {course.thumbnail_url ? (
                <Image src={course.thumbnail_url} alt="" width={400} height={160} className="aspect-[5/2] w-full object-cover" />
              ) : (
                <div aria-hidden="true" className="relative aspect-[5/1] w-full overflow-hidden bg-gold-50">
                  <span className="absolute -bottom-6 right-6 size-14 rounded-full bg-accent" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <p className="text-sm text-muted-foreground">
                  {[course.class?.board, course.class?.name].filter(Boolean).join(", ") || "Independent"}
                </p>
                <h2 className="mt-0.5 text-lg leading-snug text-primary">{course.title}</h2>
                {course.description ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{course.description}</p> : null}
                <p className="tnum mt-3 text-sm font-semibold text-foreground">
                  {course.subject}, ₹{Number(course.fee_inr ?? 0).toLocaleString("en-IN")}
                </p>
                <div className="mt-auto flex gap-2 pt-4">
                  <button
                    type="button"
                    className={cn(stitchSecondaryButtonClass, "min-h-9 flex-1")}
                    onClick={() => {
                      setEditingCourse(course);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="stitch-press min-h-9 rounded-lg px-3 text-sm font-semibold text-destructive transition-colors duration-(--duration-fast) hover:bg-danger-soft"
                    onClick={() => void handleDelete(course.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
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
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <AdminCoursesPageInner />
    </Suspense>
  );
}
