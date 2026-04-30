"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { Class, Syllabus } from "@/lib/types/database";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";

interface SyllabusUnit {
  title: string;
  topics: string[];
}

const supabase = createClient();

interface SyllabusCache {
  classes: Class[];
  syllabi: (Syllabus & { class?: Class })[];
}

function AdminSyllabusPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, user, loading: authLoading } = useAuth();
  const syllabusCacheKey = role === "teacher" && user?.id
    ? `admin:syllabus:teacher:${user.id}`
    : "admin:syllabus:admin";
  const [classes, setClasses] = useState<Class[]>(
    () => getAdminPageCache<SyllabusCache>(syllabusCacheKey)?.classes ?? [],
  );
  const [syllabi, setSyllabi] = useState<(Syllabus & { class?: Class })[]>(
    () => getAdminPageCache<SyllabusCache>(syllabusCacheKey)?.syllabi ?? [],
  );
  const [loading, setLoading] = useState(
    () => getAdminPageCache<SyllabusCache>(syllabusCacheKey) === null,
  );
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);
  const [actionError, setActionError] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formUnits, setFormUnits] = useState<SyllabusUnit[]>([{ title: "", topics: [""] }]);
  const selectedClass =
    classes.find((item) => item.id === formClassId) ?? null;

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

    if (role !== "admin" && role !== "super_admin" && role !== "teacher") {
      return;
    }

    setLoading(true);

    if (role === "teacher" && user?.id) {
      const { data: accessRows } = await supabase
        .from("teacher_class_access")
        .select("class_id")
        .eq("teacher_profile_id", user.id);

      const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map(
        (row) => row.class_id,
      );

      if (classIds.length === 0) {
        setClasses([]);
        setSyllabi([]);
        setLoading(false);
        return;
      }

      const [{ data: classData }, { data: syllabusData }] = await Promise.all([
        supabase.from("classes").select("*").in("id", classIds).order("sort_order"),
        supabase
          .from("syllabus")
          .select("*, class:classes(*)")
          .in("class_id", classIds)
          .order("subject"),
      ]);

        const nextClasses = (classData as Class[] | null) ?? [];
        const nextSyllabi = (syllabusData as (Syllabus & { class?: Class })[] | null) ?? [];
        setClasses(nextClasses);
        setSyllabi(nextSyllabi);
        setAdminPageCache<SyllabusCache>(syllabusCacheKey, {
          classes: nextClasses,
          syllabi: nextSyllabi,
        });
        setLoading(false);
        return;
      }

    const [{ data: classData }, { data: syllabusData }] = await Promise.all([
      supabase.from("classes").select("*").order("sort_order"),
      supabase.from("syllabus").select("*, class:classes(*)").order("subject"),
    ]);
    const nextClasses = (classData as Class[] | null) ?? [];
    const nextSyllabi = (syllabusData as (Syllabus & { class?: Class })[] | null) ?? [];
    setClasses(nextClasses);
    setSyllabi(nextSyllabi);
    setAdminPageCache<SyllabusCache>(syllabusCacheKey, {
      classes: nextClasses,
      syllabi: nextSyllabi,
    });
    setLoading(false);
  }, [authLoading, role, router, syllabusCacheKey, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (formClassId || classes.length === 0) return;
    setFormClassId(classes[0]?.id ?? "");
  }, [classes, formClassId]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin" && role !== "teacher") return;
    if (searchParams?.get("create") === "1" && !dialogOpen) {
      setEditingSyllabus(null);
      setFormClassId("");
      setFormSubject("");
      setFormUnits([{ title: "", topics: [""] }]);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, dialogOpen, router, pathname]);

  function openCreate() {
    setActionError("");
    setEditingSyllabus(null);
    setFormClassId("");
    setFormSubject("");
    setFormUnits([{ title: "", topics: [""] }]);
    setDialogOpen(true);
  }

  function openEdit(item: Syllabus) {
    setActionError("");
    setEditingSyllabus(item);
    setFormClassId(item.class_id);
    setFormSubject(item.subject);
    const content = item.content as { units?: SyllabusUnit[] };
    setFormUnits(content?.units?.length ? content.units : [{ title: "", topics: [""] }]);
    setDialogOpen(true);
  }

  function addUnit() {
    setFormUnits((previous) => [...previous, { title: "", topics: [""] }]);
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

  function removeUnit(index: number) {
    setFormUnits((previous) => previous.filter((_, unitIndex) => unitIndex !== index));
  }

  function updateUnitTitle(index: number, title: string) {
    setFormUnits((previous) =>
      previous.map((item, unitIndex) =>
        unitIndex === index ? { ...item, title } : item
      )
    );
  }

  function updateTopics(index: number, text: string) {
    setFormUnits((previous) =>
      previous.map((item, unitIndex) =>
        unitIndex === index
          ? { ...item, topics: text.split("\n").filter(Boolean) }
          : item
      )
    );
  }

  async function handleSave() {
    if (!formClassId || !formSubject) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setSaving(false);
      return;
    }

    const payload = {
      class_id: formClassId,
      subject: formSubject,
      content: { units: formUnits },
      updated_by: user.id,
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
        description="Publish subject structures, unit maps, and topic progressions in the same editorial system as the Stitch editor."
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
            icon={FileText}
            title="No Syllabus Published"
            description="Create the first syllabus entry to establish a modular roadmap for students."
          />
        </div>
      ) : (
        <div id="published-syllabus-list" className="mt-10 grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-2">
          {syllabi.map((item) => {
            const content = item.content as { units?: SyllabusUnit[] };
            return (
              <article key={item.id} className={stitchPanelClass}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="stitch-kicker">{item.class?.name ?? "STC Curriculum"}</p>
                    <h2 className="mt-4 text-4xl text-foreground">{item.subject}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={stitchSecondaryButtonClass} onClick={() => openEdit(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-destructive/20 px-5 py-3 text-sm text-destructive transition hover:bg-destructive/10"
                      onClick={() => void handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {(content.units ?? []).map((unit, index) => (
                    <div key={unit.title + index} className="rounded-[20px] border border-border bg-muted p-4">
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        Unit {index + 1}: {unit.title}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {unit.topics.map((topic) => (
                          <p key={topic}>{topic}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSyllabus ? "Edit Syllabus" : "New Syllabus"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Class</label>
                <Select value={formClassId} onValueChange={(value) => setFormClassId(value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class">
                      {selectedClass ? selectedClass.name : undefined}
                    </SelectValue>
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

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Units</label>
                <Button variant="outline" size="sm" onClick={addUnit} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add Unit
                </Button>
              </div>
              <div className="space-y-3">
                {formUnits.map((unit, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">Unit {index + 1}</span>
                      <Input
                        value={unit.title}
                        onChange={(event) => updateUnitTitle(index, event.target.value)}
                        className="h-8 text-sm"
                      />
                      {formUnits.length > 1 ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeUnit(index)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                    <Textarea
                      value={unit.topics.join("\n")}
                      onChange={(event) => updateTopics(index, event.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
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
