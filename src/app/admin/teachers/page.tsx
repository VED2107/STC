"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ImageOff, Search, Users } from "lucide-react";
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
import { TeacherFormDialog } from "@/components/admin/teacher-form-dialog";
import type { Teacher } from "@/lib/types/database";

function AdminTeachersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("teachers").select("*").order("name", { ascending: true });
    setTeachers((data as Teacher[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role === "teacher") {
      router.push("/admin/attendance");
      return;
    }

    if (role === "admin") {
      void fetchTeachers();
      return;
    }

    if (role === "student") {
      router.push("/dashboard");
      return;
    }
  }, [fetchTeachers, role, router]);

  useEffect(() => {
    if (role !== "admin") return;
    if (searchParams?.get("create") === "1" && !dialogOpen) {
      setEditingTeacher(undefined);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, dialogOpen, router, pathname]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this teacher?")) return;
    const supabase = createClient();
    await supabase.from("teachers").delete().eq("id", id);
    void fetchTeachers();
  }

  const filtered = teachers.filter((teacher) => {
    const haystack = `${teacher.name} ${teacher.subject} ${teacher.qualification}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

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
          <Users className="h-10 w-10 animate-pulse text-primary" />
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
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((teacher) => (
            <article key={teacher.id} className={cn(stitchPanelClass, "overflow-hidden p-0")}>
              <div className="relative">
                {teacher.photo_url ? (
                  <Image
                    src={teacher.photo_url}
                    alt={teacher.name}
                    width={400}
                    height={440}
                    className="aspect-[1.1] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[1.1] w-full items-center justify-center bg-muted text-muted-foreground">
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                      <ImageOff className="h-4 w-4" />
                      No Photo Uploaded
                    </span>
                  </div>
                )}
                <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
                  Active
                </span>
              </div>
              <div className="p-6">
                <h2 className="text-4xl leading-tight text-primary">{teacher.name}</h2>
                <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  {teacher.subject}
                </p>
                <p className="mt-6 text-sm leading-7 text-muted-foreground">
                  {teacher.qualification}
                </p>
                {teacher.bio ? (
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{teacher.bio}</p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-2">
                  <span className="stitch-pill px-3 py-1 text-[10px]">Pedagogy</span>
                  <span className="stitch-pill px-3 py-1 text-[10px]">Atelier</span>
                </div>
                <div className="mt-8 flex gap-3">
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
          ))}

          <button
            type="button"
            className={cn(
              stitchPanelClass,
              "flex min-h-[420px] flex-col items-center justify-center border-dashed text-center"
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
          <Users className="h-10 w-10 animate-pulse text-primary" />
        </div>
      }
    >
      <AdminTeachersPageInner />
    </Suspense>
  );
}
