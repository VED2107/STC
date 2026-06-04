"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState, useMemo } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { BookOpen, GraduationCap, ImageOff, Mail, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchInputClass,
  stitchPanelClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const TeacherFormDialog = dynamic(() => import("@/components/admin/teacher-form-dialog").then(mod => ({ default: mod.TeacherFormDialog })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>
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
    if (!confirm("Delete this teacher?")) return;
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
    <div className="px-6 py-8 md:px-10">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <StitchSectionHeader
          eyebrow="Administration Hub"
          title="Manage Teachers"
          description="Curate your faculty of distinguished scholars and educators. Oversight of qualifications, tenure, and curriculum mapping."
        />
        <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(stitchInputClass, "pl-11")}
              placeholder="Search faculty..."
            />
          </div>
          <button
            type="button"
            className={cn(stitchButtonClass, "whitespace-nowrap")}
            onClick={() => {
              setEditingTeacher(undefined);
              setDialogOpen(true);
            }}
          >
            Create Teacher
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={Users}
            title="No Faculty Published"
            description="Add your first faculty profile to begin curating the academic roster."
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
              Create Teacher
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {filtered.map((teacher) => {
            const initials = teacher.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
            const hue = teacher.name.charCodeAt(0) * 7 % 360;

            return (
            <article key={teacher.id} className={cn(stitchPanelClass, "stitch-hover-lift group overflow-hidden p-0")}>
              <div className="relative">
                {teacher.photo_url ? (
                  <Image
                    src={teacher.photo_url}
                    alt={teacher.name}
                    width={400}
                    height={440}
                    className="aspect-[1.1] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    className="flex aspect-[1.1] w-full items-center justify-center"
                    style={{ background: `linear-gradient(135deg, hsl(${hue}, 45%, 92%), hsl(${hue}, 35%, 85%))` }}
                  >
                    <span
                      className="font-heading text-6xl font-bold"
                      style={{ color: `hsl(${hue}, 40%, 45%)` }}
                    >
                      {initials}
                    </span>
                  </div>
                )}
                <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur-sm">
                  Active
                </span>
              </div>
              <div className="p-6">
                <h2 className="text-3xl leading-tight text-primary sm:text-4xl">{teacher.name}</h2>
                <div className="mt-3 flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-secondary" />
                  <p className="text-[11px] uppercase tracking-[0.22em] text-secondary">
                    {teacher.subject}
                  </p>
                </div>
                <div className="mt-5 flex items-start gap-2">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                  <p className="text-sm leading-7 text-muted-foreground">
                    {teacher.qualification}
                  </p>
                </div>
                {teacher.bio ? (
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{teacher.bio}</p>
                ) : null}
                <div className="mt-6 h-px bg-gradient-to-r from-secondary/20 via-secondary/5 to-transparent" />
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className={stitchButtonClass}
                    onClick={() => {
                      setEditingTeacher(teacher);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-destructive/20 px-5 py-3 text-sm text-destructive transition hover:bg-destructive/10"
                    onClick={() => void handleDelete(teacher.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
            );
          })}

          <button
            type="button"
            className={cn(
              stitchPanelClass,
              "flex min-h-[280px] md:min-h-[420px] flex-col items-center justify-center border-dashed text-center"
            )}
            onClick={() => {
              setEditingTeacher(undefined);
              setDialogOpen(true);
            }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="mt-6 text-3xl text-primary">Recruit New Faculty</h3>
            <p className="mt-3 max-w-xs text-sm leading-7 text-muted-foreground">
              Add a scholar to your academic ecosystem with the same visual
              language as the Stitch export.
            </p>
          </button>
        </div>
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
