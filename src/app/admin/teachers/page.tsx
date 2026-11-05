"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { confirmAction } from "@/components/ui/feedback";
import { useCallback, useEffect, useState, useMemo } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Search,
  Users,
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

const TeacherFormDialog = dynamic(() => import("@/components/admin/teacher-form-dialog").then(mod => ({ default: mod.TeacherFormDialog })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div></div>
});
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";
import { invalidateAfterTeacherMutation } from "@/lib/cache-invalidation";
import type { Teacher } from "@/lib/types/database";

const supabase = createClient();
const TEACHERS_CACHE_KEY = "admin:teachers";

function AdminTeachersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, loading: authLoading } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>(
    () => getAdminPageCache<Teacher[]>(TEACHERS_CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(() => getAdminPageCache<Teacher[]>(TEACHERS_CACHE_KEY) === null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | undefined>();

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setEditingTeacher(undefined);
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  const fetchTeachers = useCallback(async () => {
    const cachedTeachers = getAdminPageStorageCache<Teacher[]>(TEACHERS_CACHE_KEY);
    if (cachedTeachers) {
      setTeachers(cachedTeachers);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const { data } = await supabase.from("teachers").select("*").order("name", { ascending: true });
    const nextTeachers = (data as Teacher[] | null) ?? [];
    setTeachers(nextTeachers);
    setAdminPageCache(TEACHERS_CACHE_KEY, nextTeachers);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (role === "teacher") {
      router.push("/admin/attendance");
      return;
    }

    if (role === "admin" || role === "super_admin") {
      void fetchTeachers();
      return;
    }

    if (role === "student") {
      router.push("/dashboard");
      return;
    }
  }, [fetchTeachers, role, router, authLoading]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    if (searchParams?.get("create") === "1" && !dialogOpen) {
      setEditingTeacher(undefined);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, dialogOpen, router, pathname]);

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirmAction({ title: "Delete this teacher?", description: "This cannot be undone.", confirmLabel: "Delete teacher", destructive: true }))) return;
    await supabase.from("teachers").delete().eq("id", id);
    invalidateAfterTeacherMutation();
    void fetchTeachers();
  }, [fetchTeachers]);

  // Memoized filtered teachers for better performance
  const filtered = useMemo(() => {
    if (!search.trim()) return teachers;

    const searchTerm = search.toLowerCase();
    return teachers.filter((teacher) => {
      const haystack = `${teacher.name} ${teacher.subject} ${teacher.qualification}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [teachers, search]);

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-primary md:text-4xl">Teachers</h1>
          <p className="mt-1 text-muted-foreground">Add teachers and manage their subjects and class access.</p>
        </div>
        <button
          type="button"
          className={stitchButtonClass}
          onClick={() => {
            setEditingTeacher(undefined);
            setDialogOpen(true);
          }}
        >
          Add teacher
        </button>
      </div>

      <div className="relative mt-5 max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search teachers"
          className={cn(stitchInputClass, "pl-9")}
          placeholder="Search teachers"
        />
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={Users}
            title="No teachers yet"
            description="Add a teacher to give them access to their classes."
          />
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className={stitchButtonClass}
              onClick={() => {
                setEditingTeacher(undefined);
                setDialogOpen(true);
              }}
            >
              Add teacher
            </button>
          </div>
        </div>
      ) : (
        <ul className="rise-in mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((teacher) => {
            const initials = teacher.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

            return (
              <li key={teacher.id} className="stitch-panel stitch-hover-lift flex flex-col p-4">
                <div className="flex items-start gap-3">
                  {teacher.photo_url ? (
                    <Image src={teacher.photo_url} alt="" width={56} height={56} className="size-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent font-heading text-lg font-bold text-primary">
                      {initials}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-lg text-primary">{teacher.name}</h2>
                    <p className="text-sm font-medium text-secondary">{teacher.subject}</p>
                    <p className="text-sm text-muted-foreground">{teacher.qualification}</p>
                  </div>
                </div>
                {teacher.bio ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{teacher.bio}</p> : null}
                <div className="mt-auto flex gap-2 pt-4">
                  <button
                    type="button"
                    className={cn(stitchSecondaryButtonClass, "min-h-9 flex-1")}
                    onClick={() => {
                      setEditingTeacher(teacher);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="stitch-press min-h-9 rounded-lg px-3 text-sm font-semibold text-destructive transition-colors duration-(--duration-fast) hover:bg-danger-soft"
                    onClick={() => void handleDelete(teacher.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TeacherFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={fetchTeachers}
        editTeacher={editingTeacher}
      />
    </div>
  );
}

export default function AdminTeachersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <AdminTeachersPageInner />
    </Suspense>
  );
}
