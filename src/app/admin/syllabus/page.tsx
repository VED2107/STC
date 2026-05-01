"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, FileText, Loader2, Save } from "lucide-react";
import type { Class, MaterialType, Syllabus } from "@/lib/types/database";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";

interface MaterialSummary {
  id: string;
  title: string;
  type: MaterialType | "link";
  subject: string;
  class_id: string;
  file_url: string;
}

interface SyllabusCache {
  classes: Class[];
  syllabi: (Syllabus & { class?: Class })[];
}

type DivisionFilter = "all" | "primary" | "senior";
type BoardFilter = "all" | "GSEB" | "CBSE";

const supabase = createClient();

function AdminSyllabusPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, user, loading: authLoading } = useAuth();
  const teacherProfileId = user?.id ?? null;
  const syllabusCacheKey = role === "teacher" && user?.id
    ? `admin:syllabus:teacher:${user.id}`
    : "admin:syllabus:admin";
  const [classes, setClasses] = useState<Class[]>(
    () => getAdminPageCache<SyllabusCache>(syllabusCacheKey)?.classes ?? [],
  );
  const [syllabi, setSyllabi] = useState<(Syllabus & { class?: Class })[]>(
    () => getAdminPageCache<SyllabusCache>(syllabusCacheKey)?.syllabi ?? [],
  );
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [loading, setLoading] = useState(
    () => getAdminPageCache<SyllabusCache>(syllabusCacheKey) === null,
  );
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);
  const [actionError, setActionError] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>("all");
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const selectedClass = classes.find((item) => item.id === formClassId) ?? null;
  const primaryLevels = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);

  const materialMap = useMemo(() => {
    return materials.reduce<Record<string, MaterialSummary[]>>((accumulator, item) => {
      const key = `${item.class_id}::${item.subject.toLowerCase()}`;
      const existing = accumulator[key] ?? [];
      existing.push(item);
      accumulator[key] = existing;
      return accumulator;
    }, {});
  }, [materials]);

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setEditingSyllabus(null);
      setActionError("");
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  const fetchData = useCallback(async () => {
    const cachedSyllabus = getAdminPageStorageCache<SyllabusCache>(syllabusCacheKey);
    if (cachedSyllabus) {
      setClasses(cachedSyllabus.classes);
      setSyllabi(cachedSyllabus.syllabi);
      setLoading(false);
    }

    if (authLoading) return;

    if (role === "student") {
      router.push("/dashboard");
      return;
    }

    if (role !== "admin" && role !== "super_admin" && role !== "teacher") return;

    setLoading(true);

    if (role === "teacher" && teacherProfileId) {
      const { data: accessRows } = await supabase
        .from("teacher_class_access")
        .select("class_id")
        .eq("teacher_profile_id", teacherProfileId);

      const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map(
        (row) => row.class_id,
      );

      if (classIds.length === 0) {
        setClasses([]);
        setSyllabi([]);
        setMaterials([]);
        setLoading(false);
        return;
      }

      const [{ data: classData }, { data: syllabusData }, { data: materialData }] = await Promise.all([
        supabase.from("classes").select("*").in("id", classIds).order("sort_order"),
        supabase
          .from("syllabus")
          .select("*, class:classes(*)")
          .in("class_id", classIds)
          .order("subject"),
        supabase
          .from("materials")
          .select("id, title, type, subject, class_id, file_url")
          .in("class_id", classIds)
          .order("sort_order"),
      ]);

      const nextClasses = (classData as Class[] | null) ?? [];
      const nextSyllabi = (syllabusData as (Syllabus & { class?: Class })[] | null) ?? [];
      setClasses(nextClasses);
      setSyllabi(nextSyllabi);
      setMaterials((materialData as MaterialSummary[] | null) ?? []);
      setAdminPageCache<SyllabusCache>(syllabusCacheKey, {
        classes: nextClasses,
        syllabi: nextSyllabi,
      });
      setLoading(false);
      return;
    }

    const [{ data: classData }, { data: syllabusData }, { data: materialData }] = await Promise.all([
      supabase.from("classes").select("*").order("sort_order"),
      supabase.from("syllabus").select("*, class:classes(*)").order("subject"),
      supabase.from("materials").select("id, title, type, subject, class_id, file_url").order("sort_order"),
    ]);

    const nextClasses = (classData as Class[] | null) ?? [];
    const nextSyllabi = (syllabusData as (Syllabus & { class?: Class })[] | null) ?? [];
    setClasses(nextClasses);
    setSyllabi(nextSyllabi);
    setMaterials((materialData as MaterialSummary[] | null) ?? []);
    setAdminPageCache<SyllabusCache>(syllabusCacheKey, {
      classes: nextClasses,
      syllabi: nextSyllabi,
    });
    setLoading(false);
  }, [authLoading, role, router, syllabusCacheKey, teacherProfileId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (formClassId || classes.length === 0) return;
    setFormClassId(classes[0]?.id ?? "");
  }, [classes, formClassId]);

  const filteredClasses = classes.filter((item) => {
    const isPrimary = primaryLevels.has(item.level);
    if (divisionFilter === "primary" && !isPrimary) return false;
    if (divisionFilter === "senior" && isPrimary) return false;
    if (boardFilter !== "all" && item.board !== boardFilter) return false;
    if (selectedClassId !== "all" && item.id !== selectedClassId) return false;
    return true;
  });

  useEffect(() => {
    if (selectedClassId === "all") return;
    if (!filteredClasses.some((item) => item.id === selectedClassId)) {
      setSelectedClassId("all");
    }
  }, [filteredClasses, selectedClassId]);

  const visibleSyllabi = syllabi.filter((item) => {
    const isPrimary = primaryLevels.has(item.class?.level ?? "");
    if (divisionFilter === "primary" && !isPrimary) return false;
    if (divisionFilter === "senior" && isPrimary) return false;
    if (boardFilter !== "all" && item.class?.board !== boardFilter) return false;
    if (selectedClassId !== "all" && item.class_id !== selectedClassId) return false;
    return true;
  });

  const selectedClassLabel = filteredClasses.find((item) => item.id === selectedClassId)?.name ?? "All classes";

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin" && role !== "teacher") return;
    if (searchParams?.get("create") === "1" && !dialogOpen) {
      setEditingSyllabus(null);
      setFormClassId("");
      setFormSubject("");
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, dialogOpen, router, pathname]);

  function openCreate() {
    setActionError("");
    setEditingSyllabus(null);
    setFormClassId("");
    setFormSubject("");
    setDialogOpen(true);
  }

  function openEdit(item: Syllabus) {
    setActionError("");
    setEditingSyllabus(item);
    setFormClassId(item.class_id);
    setFormSubject(item.subject);
    setDialogOpen(true);
  }

  function handlePreviewStructure() {
    if (syllabi.length === 0) {
      setActionError("Add at least one syllabus entry before previewing the published structure.");
      return;
    }

    setActionError("");
    document.getElementById("published-syllabus-list")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSave() {
    if (!formClassId || !formSubject.trim()) return;
    setSaving(true);
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser?.id) {
      setSaving(false);
      return;
    }

    const payload = {
      class_id: formClassId,
      subject: formSubject.trim(),
      content: {},
      updated_by: authUser.id,
    };

    if (editingSyllabus) {
      await supabase.from("syllabus").update(payload).eq("id", editingSyllabus.id);
    } else {
      await supabase.from("syllabus").insert(payload);
    }

    setActionError("");
    setSaving(false);
    setDialogOpen(false);
    void fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this syllabus entry?")) return;
    await supabase.from("syllabus").delete().eq("id", id);
    void fetchData();
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Curriculum Editorial Desk"
        title="Syllabus Architecture"
        description="Manage board and subject entries. Uploaded materials now power the syllabus display automatically."
        action={
          <>
            <button
              type="button"
              className={stitchSecondaryButtonClass}
              onClick={handlePreviewStructure}
              disabled={syllabi.length === 0}
            >
              Preview Structure
            </button>
            <button type="button" className={stitchButtonClass} onClick={openCreate}>
              Add Syllabus
            </button>
          </>
        }
      />

      {actionError ? (
        <div className="mt-6 rounded-[18px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      ) : syllabi.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={BookOpen}
            title="No Syllabus Published"
            description="Create the first syllabus entry to establish a board and subject roadmap for students."
          />
        </div>
      ) : (
        <>
          <div className="mt-8 rounded-[22px] border border-black/5 bg-white p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="min-w-[220px]">
                <label className="text-sm font-medium">Division</label>
                <Select value={divisionFilter} onValueChange={(value) => setDivisionFilter((value ?? "all") as DivisionFilter)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All divisions</SelectItem>
                    <SelectItem value="primary">Class 1-9</SelectItem>
                    <SelectItem value="senior">SSC / HSC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[220px]">
                <label className="text-sm font-medium">Board</label>
                <Select value={boardFilter} onValueChange={(value) => setBoardFilter((value ?? "all") as BoardFilter)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All boards</SelectItem>
                    <SelectItem value="GSEB">GSEB</SelectItem>
                    <SelectItem value="CBSE">CBSE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[260px]">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClassId} onValueChange={(value) => setSelectedClassId(value ?? "all")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue>{selectedClassId === "all" ? "All classes" : selectedClassLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {filteredClasses.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.board})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "lg:ml-auto")}
                onClick={() => {
                  setDivisionFilter("all");
                  setBoardFilter("all");
                  setSelectedClassId("all");
                }}
                disabled={divisionFilter === "all" && boardFilter === "all" && selectedClassId === "all"}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div id="published-syllabus-list" className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleSyllabi.map((item) => {
              const linkedMaterials = materialMap[`${item.class_id}::${item.subject.toLowerCase()}`] ?? [];
              return (
                <article key={item.id} className={cn(stitchPanelClass, "p-5 md:p-6")}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="stitch-kicker">{item.class?.name ?? "STC Curriculum"}</p>
                      <h2 className="mt-2 text-2xl text-foreground md:text-3xl">{item.subject}</h2>
                      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        {item.class?.board ?? "STC"} · Level {item.class?.level ?? "-"} · {linkedMaterials.length} materials
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className={cn(stitchSecondaryButtonClass, "px-4 py-2 text-xs")} onClick={() => openEdit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-destructive/20 px-4 py-2 text-xs text-destructive transition hover:bg-destructive/10"
                        onClick={() => void handleDelete(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {linkedMaterials.length > 0 ? linkedMaterials.map((material) => (
                      <a
                        key={material.id}
                        href={material.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-[18px] border border-border bg-muted/60 p-3.5 transition hover:border-primary/25"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{material.title}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {material.type}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-primary">Open</span>
                      </a>
                    )) : (
                      <div className="rounded-[18px] border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No materials uploaded for this board and subject yet.
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSyllabus ? "Edit Syllabus" : "New Syllabus"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Class</label>
                <Select value={formClassId} onValueChange={(value) => setFormClassId(value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class">{selectedClass ? selectedClass.name : undefined}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Subject</label>
                <Input value={formSubject} onChange={(event) => setFormSubject(event.target.value)} />
              </div>
            </div>

            <div className="rounded-[18px] border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
              Unit editing has been removed. The syllabus page now reflects uploaded materials for the selected class and subject.
            </div>

            <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingSyllabus ? "Update Syllabus" : "Create Syllabus"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminSyllabusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <AdminSyllabusPageInner />
    </Suspense>
  );
}
