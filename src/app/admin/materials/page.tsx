"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, GripVertical, Link2, Loader2, Upload } from "lucide-react";
import type { BoardType, Class, Course, Material, MaterialType } from "@/lib/types/database";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { resolveUploadContentType, sanitizeUploadFileName } from "@/lib/supabase/upload";
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";

type MaterialRecord = Material & {
  class?: Pick<Class, "id" | "name" | "board" | "level"> | null;
  course?: Pick<Course, "id" | "title" | "subject"> | null;
};

type SyllabusSubjectRow = {
  class_id: string;
  subject: string;
  class?: Pick<Class, "id" | "name" | "board" | "level"> | null;
};

interface MaterialsCache {
  classes: Class[];
  courses: Course[];
  syllabi: SyllabusSubjectRow[];
}

const supabase = createClient();

function AdminMaterialsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, user, loading: authLoading } = useAuth();
  const dataCacheKey =
    role === "teacher" && user?.id ? `admin:materials:data:teacher:${user.id}` : "admin:materials:data:admin";
  const [classes, setClasses] = useState<Class[]>(
    () => getAdminPageCache<MaterialsCache>(dataCacheKey)?.classes ?? [],
  );
  const [courses, setCourses] = useState<Course[]>(
    () => getAdminPageCache<MaterialsCache>(dataCacheKey)?.courses ?? [],
  );
  const [syllabi, setSyllabi] = useState<SyllabusSubjectRow[]>(
    () => getAdminPageCache<MaterialsCache>(dataCacheKey)?.syllabi ?? [],
  );
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<"all" | BoardType>("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [materialTypeFilter, setMaterialTypeFilter] = useState<"all" | MaterialType | "link">("all");
  const [materialSearch, setMaterialSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("pdf");
  const [fileUrl, setFileUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "link">("file");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [draggingMaterialId, setDraggingMaterialId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const classesById = useMemo(
    () => new Map(classes.map((item) => [item.id, item])),
    [classes],
  );

  const availableBoards = useMemo(
    () => Array.from(new Set(classes.map((item) => item.board))).sort(),
    [classes],
  );

  const availableClasses = useMemo(() => {
    return classes
      .filter((item) => selectedBoard === "all" || item.board === selectedBoard)
      .sort((left, right) => left.sort_order - right.sort_order);
  }, [classes, selectedBoard]);

  const availableSubjects = useMemo(() => {
    return Array.from(
      new Set(
        syllabi
          .filter((item) => {
            const itemBoard = item.class?.board ?? classesById.get(item.class_id)?.board;
            if (selectedBoard !== "all" && itemBoard !== selectedBoard) return false;
            if (selectedClassId !== "all" && item.class_id !== selectedClassId) return false;
            return true;
          })
          .map((item) => item.subject.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [classesById, selectedBoard, selectedClassId, syllabi]);

  const matchingSyllabusEntries = useMemo(() => {
    if (selectedSubject === "all") return [];
    return syllabi.filter((item) => {
      const itemBoard = item.class?.board ?? classesById.get(item.class_id)?.board;
      const subjectMatches = item.subject.trim().toLowerCase() === selectedSubject.toLowerCase();
      const boardMatches = selectedBoard === "all" || itemBoard === selectedBoard;
      const classMatches = selectedClassId === "all" || item.class_id === selectedClassId;
      return subjectMatches && boardMatches && classMatches;
    });
  }, [classesById, selectedBoard, selectedClassId, selectedSubject, syllabi]);

  const matchingCourses = useMemo(() => {
    if (selectedSubject === "all") return [];
    return courses.filter((course) => {
      const courseBoard = classesById.get(course.class_id)?.board;
      const subjectMatches = course.subject.trim().toLowerCase() === selectedSubject.toLowerCase();
      const boardMatches = selectedBoard === "all" || courseBoard === selectedBoard;
      const classMatches = selectedClassId === "all" || course.class_id === selectedClassId;
      return subjectMatches && boardMatches && classMatches;
    });
  }, [classesById, courses, selectedBoard, selectedClassId, selectedSubject]);

  const scopedCourses = useMemo(() => matchingCourses, [matchingCourses]);

  const selectionLabel = useMemo(() => {
    const boardLabel = selectedBoard === "all" ? "All boards" : selectedBoard;
    const subjectLabel = selectedSubject === "all" ? "All subjects" : selectedSubject;
    return `${boardLabel} / ${subjectLabel}`;
  }, [selectedBoard, selectedSubject]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      if (materialTypeFilter !== "all" && material.type !== materialTypeFilter) return false;
      if (materialSearch.trim()) {
        const haystack = [
          material.title,
          material.type,
          material.subject,
          material.class?.name ?? "",
          material.class?.board ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(materialSearch.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [materialSearch, materialTypeFilter, materials]);

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setUploadError("");
      setActionError("");
      setUploadMethod("file");
      setLinkUrl("");
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  const fetchData = useCallback(async () => {
    const cachedData = getAdminPageStorageCache<MaterialsCache>(dataCacheKey);
    if (cachedData) {
      setClasses(cachedData.classes);
      setCourses(cachedData.courses);
      setSyllabi(cachedData.syllabi);
    }

    if (authLoading) return;

    if (role === "student") {
      router.push("/dashboard");
      return;
    }

    if (role !== "admin" && role !== "super_admin" && role !== "teacher") return;

    if (role === "teacher" && user?.id) {
      const { data: accessRows } = await supabase
        .from("teacher_class_access")
        .select("class_id")
        .eq("teacher_profile_id", user.id);

      const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map((row) => row.class_id);

      if (classIds.length === 0) {
        setClasses([]);
        setCourses([]);
        setSyllabi([]);
        return;
      }

      const [{ data: classData }, { data: courseData }, { data: syllabusData }] = await Promise.all([
        supabase.from("classes").select("*").in("id", classIds).order("sort_order"),
        supabase.from("courses").select("*").in("class_id", classIds).order("title"),
        supabase
          .from("syllabus")
          .select("class_id, subject, class:classes(id, name, board, level)")
          .in("class_id", classIds)
          .order("subject"),
      ]);

      const nextData: MaterialsCache = {
        classes: (classData as Class[] | null) ?? [],
        courses: (courseData as Course[] | null) ?? [],
        syllabi: (syllabusData as SyllabusSubjectRow[] | null) ?? [],
      };
      setClasses(nextData.classes);
      setCourses(nextData.courses);
      setSyllabi(nextData.syllabi);
      setAdminPageCache(dataCacheKey, nextData);
      return;
    }

    const [{ data: classData }, { data: courseData }, { data: syllabusData }] = await Promise.all([
      supabase.from("classes").select("*").order("sort_order"),
      supabase.from("courses").select("*").order("title"),
      supabase
        .from("syllabus")
        .select("class_id, subject, class:classes(id, name, board, level)")
        .order("subject"),
    ]);

    const nextData: MaterialsCache = {
      classes: (classData as Class[] | null) ?? [],
      courses: (courseData as Course[] | null) ?? [],
      syllabi: (syllabusData as SyllabusSubjectRow[] | null) ?? [],
    };
    setClasses(nextData.classes);
    setCourses(nextData.courses);
    setSyllabi(nextData.syllabi);
    setAdminPageCache(dataCacheKey, nextData);
  }, [authLoading, dataCacheKey, role, router, user?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedBoard === "all") return;
    if (!availableBoards.includes(selectedBoard)) {
      setSelectedBoard("all");
    }
  }, [availableBoards, selectedBoard]);

  useEffect(() => {
    if (availableSubjects.length === 0) {
      setSelectedSubject("all");
      return;
    }
    if (selectedSubject !== "all" && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0] ?? "all");
    }
  }, [availableSubjects, selectedSubject]);

  useEffect(() => {
    if (selectedClassId !== "all" && !availableClasses.some((item) => item.id === selectedClassId)) {
      setSelectedClassId("all");
    }
  }, [availableClasses, selectedClassId]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin" && role !== "teacher") return;
    if (searchParams?.get("create") === "1") {
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [pathname, role, router, searchParams]);

  const fetchMaterials = useCallback(async () => {
    const classIds =
      selectedClassId === "all"
        ? availableClasses.map((item) => item.id)
        : [selectedClassId].filter(Boolean);

    if (classIds.length === 0) {
      setMaterials([]);
      setLoading(false);
      return;
    }

    if (selectedSubject !== "all" && matchingSyllabusEntries.length === 0) {
      setMaterials([]);
      setLoading(false);
      return;
    }

    const materialsCacheKey = `admin:materials:list:${selectedBoard}:${selectedSubject}:${selectedClassId}`;
    const cachedMaterials = getAdminPageStorageCache<MaterialRecord[]>(materialsCacheKey);
    if (cachedMaterials) {
      setMaterials(cachedMaterials);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let query = supabase
      .from("materials")
      .select("*, class:classes(id, name, board, level), course:courses(id, title, subject)")
      .order("sort_order");

    if (selectedSubject !== "all") {
      query = query.eq("subject", selectedSubject);
    }

    query =
      classIds.length === 1
        ? query.eq("class_id", classIds[0])
        : query.in("class_id", classIds);

    const { data } = await query;
    const nextMaterials = (data as MaterialRecord[] | null) ?? [];
    setMaterials(nextMaterials);
    setAdminPageCache(materialsCacheKey, nextMaterials);
    setLoading(false);
  }, [availableClasses, matchingSyllabusEntries, selectedBoard, selectedClassId, selectedSubject]);

  useEffect(() => {
    void fetchMaterials();
  }, [fetchMaterials]);

  function openPublishDialog() {
    if (selectedBoard === "all" || selectedSubject === "all") {
      setActionError("Select a board and subject before publishing materials.");
      return;
    }

    if (matchingSyllabusEntries.length === 0) {
      setActionError("No matching class subject was found for this board and subject.");
      return;
    }

    setActionError("");
    setUploadError("");
    setDialogOpen(true);
  }

  function handlePreviewSyllabus() {
    if (selectedBoard === "all" || selectedSubject === "all") {
      setActionError("Select a board and subject to preview the linked syllabus.");
      return;
    }

    setActionError("");
    window.open("/syllabus", "_blank", "noopener,noreferrer");
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    const safeName = sanitizeUploadFileName(file.name);
    const filePath = `materials/${Date.now()}-${safeName}`;
    const contentType = resolveUploadContentType(file, "application/octet-stream");
    try {
      const { data, error } = await supabase.storage
        .from("materials")
        .upload(filePath, file, { contentType, upsert: true });
      if (error) {
        setUploadError(error.message);
        return;
      }
      const { data: urlData } = supabase.storage.from("materials").getPublicUrl(data.path);
      setFileUrl(urlData.publicUrl);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const resolvedUrl = (uploadMethod === "link" ? linkUrl : fileUrl).trim();
    const resolvedType = uploadMethod === "link" ? ("link" as MaterialType) : type;
    if (!normalizedTitle) {
      setUploadError("Enter a title before publishing.");
      return;
    }

    if (!resolvedUrl) {
      setUploadError(uploadMethod === "link" ? "Paste a valid link before publishing." : "Upload the file before publishing.");
      return;
    }

    if (selectedSubject === "all" || matchingSyllabusEntries.length === 0) {
      setUploadError("Choose a valid class subject before publishing.");
      return;
    }

    const countsByClass = materials.reduce<Record<string, number>>((accumulator, material) => {
      accumulator[material.class_id] = (accumulator[material.class_id] ?? 0) + 1;
      return accumulator;
    }, {});

    const payload = matchingSyllabusEntries.map((entry) => {
      const linkedCourse =
        scopedCourses.find(
          (course) =>
            course.class_id === entry.class_id &&
            course.subject.trim().toLowerCase() === entry.subject.trim().toLowerCase(),
        ) ?? null;
      return {
        title: normalizedTitle,
        course_id: linkedCourse?.id ?? null,
        class_id: entry.class_id,
        subject: entry.subject,
        type: resolvedType,
        file_url: resolvedUrl,
        sort_order: countsByClass[entry.class_id] ?? 0,
      };
    });

    const { error } = await supabase.from("materials").insert(payload);
    if (error) {
      setUploadError(error.message);
      return;
    }
    setActionError("");
    setDialogOpen(false);
    setTitle("");
    setFileUrl("");
    setLinkUrl("");
    setType("pdf");
    setUploadMethod("file");
    setUploadError("");
    void fetchMaterials();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this material?")) return;
    await supabase.from("materials").delete().eq("id", id);
    void fetchMaterials();
  }

  function reorderByIds(list: MaterialRecord[], fromId: string, toId: string): MaterialRecord[] {
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;

    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  async function handleDrop(targetId: string) {
    if (!draggingMaterialId) return;
    if (draggingMaterialId === targetId) {
      setDraggingMaterialId(null);
      return;
    }

    const nextMaterials = reorderByIds(materials, draggingMaterialId, targetId).map((item, index) => ({
      ...item,
      sort_order: index,
    }));
    setMaterials(nextMaterials);
    setReordering(true);
    try {
      const updates = nextMaterials.map((item) =>
        supabase.from("materials").update({ sort_order: item.sort_order }).eq("id", item.id),
      );
      const results = await Promise.all(updates);
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;
    } catch {
      await fetchMaterials();
    } finally {
      setDraggingMaterialId(null);
      setReordering(false);
    }
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Curriculum / Advanced Atelier Editor"
        title="Syllabus & Materials"
        description="Publish materials by board and subject so every linked syllabus surface stays synchronized."
        action={
          <>
            <button
              type="button"
              className={stitchSecondaryButtonClass}
              onClick={handlePreviewSyllabus}
              disabled={selectedSubject === "all"}
            >
              Preview Syllabus
            </button>
            <button
              type="button"
              className={stitchButtonClass}
              onClick={openPublishDialog}
              disabled={selectedBoard === "all" || selectedSubject === "all"}
            >
              Publish Material
            </button>
          </>
        }
      />

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <div className="space-y-6">
          <div className={stitchPanelClass}>
            <p className="stitch-kicker">Publishing Scope</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div>
                <Label>Board</Label>
                <Select
                  value={selectedBoard}
                  onValueChange={(value) => setSelectedBoard((value ?? "all") as "all" | BoardType)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select board" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All boards</SelectItem>
                    {availableBoards.map((board) => (
                      <SelectItem key={board} value={board}>
                        {board}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class</Label>
                <Select
                  value={selectedClassId}
                  onValueChange={(value) => setSelectedClassId(value ?? "all")}
                  disabled={availableClasses.length === 0}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select class">
                      {selectedClassId === "all" ? "All classes" : classesById.get(selectedClassId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {availableClasses.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select
                  value={selectedSubject}
                  onValueChange={(value) => setSelectedSubject(value ?? "all")}
                  disabled={availableSubjects.length === 0}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {availableSubjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-5 rounded-[22px] border border-border bg-muted p-5 text-sm leading-7 text-muted-foreground">
              Materials published here are attached to every matching class subject under {selectionLabel}
              {selectedClassId !== "all" ? ` / ${classesById.get(selectedClassId)?.name ?? "Selected class"}` : ""}.
            </div>
            {actionError ? (
              <div className="mt-4 rounded-[18px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {actionError}
              </div>
            ) : null}
          </div>

          <div className={stitchPanelClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-4xl text-foreground">Required Reading Materials</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {matchingSyllabusEntries.length} linked class subjects for {selectionLabel}
                  {selectedClassId !== "all" ? ` / ${classesById.get(selectedClassId)?.name ?? "Class"}` : ""}
                </p>
              </div>
              <button type="button" className={stitchSecondaryButtonClass} onClick={openPublishDialog}>
                Add Material
              </button>
            </div>

            <div className="mt-6 rounded-[20px] border border-black/5 bg-muted/40 p-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_180px]">
                <div>
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative mt-2">
                    <input
                      value={materialSearch}
                      onChange={(event) => setMaterialSearch(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                      placeholder="Search by title, type, or class"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={materialTypeFilter}
                    onValueChange={(value) => setMaterialTypeFilter((value ?? "all") as "all" | MaterialType | "link")}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="notes">Notes</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>{filteredMaterials.length} materials visible</span>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => {
                    setMaterialTypeFilter("all");
                    setMaterialSearch("");
                  }}
                  disabled={materialTypeFilter === "all" && !materialSearch.trim()}
                >
                  Clear filters
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <LoadingAnimation size="md" />
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {filteredMaterials.map((material) => (
                  <div
                    key={material.id}
                    className={cn(
                      stitchPanelSoftClass,
                      "flex items-center justify-between gap-3 p-4",
                      reordering ? "opacity-70" : "",
                      draggingMaterialId === material.id ? "ring-2 ring-primary/40" : "",
                    )}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => void handleDrop(material.id)}
                  >
                    <div className="flex items-center gap-3">
                      {material.type === "link" ? (
                        <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                      <div>
                        <p className="text-base text-foreground">{material.title}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          {material.class?.board ?? "STC"} / {material.class?.name ?? "Class"} / {material.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDraggingMaterialId(material.id)}
                        onDragEnd={() => setDraggingMaterialId(null)}
                        className={cn(stitchSecondaryButtonClass, "px-3 py-2")}
                        title="Drag to reorder"
                        disabled={reordering}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <a
                        href={material.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(stitchSecondaryButtonClass, "px-4 py-2 text-xs")}
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        className="rounded-full border border-destructive/20 px-4 py-2 text-xs text-destructive transition hover:bg-destructive/10"
                        onClick={() => void handleDelete(material.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!filteredMaterials.length ? (
                  <div className={stitchPanelSoftClass}>
                    <p className="text-sm text-muted-foreground">
                      No materials match the current board and subject selection.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-1">
          <div className={cn(stitchPanelClass, "border-dashed text-center")}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/3 text-primary">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="mt-6 text-3xl text-foreground">Upload Assets</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Publish once for the selected board and subject, and mirror it across the linked syllabus entries.
            </p>
            <button type="button" className={cn(stitchSecondaryButtonClass, "mt-8")} onClick={openPublishDialog}>
              Browse Files
            </button>
          </div>

          <div className={stitchPanelClass}>
            <p className="stitch-kicker">Distribution Settings</p>
            <div className="mt-6 space-y-5 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Downloadable</span>
                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs text-primary">On</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Linked Syllabus</span>
                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs text-primary">Auto Sync</span>
              </div>
              <div className="rounded-[18px] border border-border bg-muted px-4 py-3">
                Scope: {selectionLabel}
              </div>
            </div>
          </div>

          <div className={stitchPanelClass}>
            <p className="text-base italic leading-8 text-muted-foreground">
              &quot;The curriculum is not a static document, but a living map for the intellect.&quot;
            </p>
            <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Director of Atelier
            </p>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
            <DialogDescription>
              Upload a file or paste an external link for {selectionLabel}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition",
                    uploadMethod === "file"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30",
                  )}
                  onClick={() => {
                    setUploadMethod("file");
                    setLinkUrl("");
                    setUploadError("");
                  }}
                >
                  <Upload className="h-4 w-4" />
                  Upload File
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition",
                    uploadMethod === "link"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30",
                  )}
                  onClick={() => {
                    setUploadMethod("link");
                    setFileUrl("");
                    setUploadError("");
                  }}
                >
                  <Link2 className="h-4 w-4" />
                  Add Link
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material-title">Title</Label>
              <Input id="material-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>

            {uploadMethod === "file" ? (
              <div className="space-y-2">
                <Label>File Type</Label>
                <Select
                  value={type}
                  onValueChange={(value) => {
                    const next = (value ?? "pdf") as MaterialType;
                    setType(next);
                    setFileUrl("");
                    setUploadError("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="notes">Notes</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {uploadMethod === "file" ? (
              type === "video" ? (
                <div className="space-y-2">
                  <Label htmlFor="material-url">Video URL</Label>
                  <Input
                    id="material-url"
                    type="url"
                    placeholder="https://youtube.com/..."
                    value={fileUrl}
                    onChange={(event) => setFileUrl(event.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  <div className="rounded-lg border-2 border-dashed p-6 text-center">
                    {fileUrl ? (
                      <p className="text-sm text-green-600">File uploaded successfully</p>
                    ) : (
                      <>
                        <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">Drop file or click to browse</p>
                      </>
                    )}
                    <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} className="w-full text-sm" />
                    {uploading ? <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin" /> : null}
                    {uploadError ? <p className="mt-2 text-xs text-destructive">{uploadError}</p> : null}
                  </div>
                </div>
              )
            ) : null}

            {uploadMethod === "link" ? (
              <div className="space-y-2">
                <Label htmlFor="material-link-url">Link URL</Label>
                <Input
                  id="material-link-url"
                  type="url"
                  placeholder="https://drive.google.com/... or any URL"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Paste any external URL like Google Drive, website, article, or YouTube.
                </p>
                {uploadError ? <p className="mt-1 text-xs text-destructive">{uploadError}</p> : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={(uploadMethod === "file" ? !fileUrl : !linkUrl) || uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {uploadMethod === "link" ? "Add Link" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminMaterialsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <AdminMaterialsPageInner />
    </Suspense>
  );
}
