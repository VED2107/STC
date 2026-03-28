"use client";

import { useCallback, useEffect, useState } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Loader2, Upload } from "lucide-react";
import type { Class, Course, Material, MaterialType } from "@/lib/types/database";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { resolveUploadContentType, sanitizeUploadFileName } from "@/lib/supabase/upload";

function AdminMaterialsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("pdf");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [draggingMaterialId, setDraggingMaterialId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setUploadError("");
      setActionError("");
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  useEffect(() => {
    if (role === "student") {
      router.push("/dashboard");
      return;
    }

    if (role !== "admin" && role !== "teacher") return;
    const supabase = createClient();

    async function loadClasses() {
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
          return;
        }

        const { data: classData } = await supabase
          .from("classes")
          .select("*")
          .in("id", classIds)
          .order("sort_order");
        setClasses((classData as Class[] | null) ?? []);
        return;
      }

      const { data: classData } = await supabase
        .from("classes")
        .select("*")
        .order("sort_order");
      setClasses((classData as Class[] | null) ?? []);
    }

    void loadClasses();
  }, [role, router, user?.id]);

  useEffect(() => {
    if (role !== "admin" && role !== "teacher") return;
    if (searchParams?.get("create") === "1") {
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, router, pathname]);

  useEffect(() => {
    if (selectedClassId || classes.length === 0) return;
    setSelectedClassId(classes[0]?.id ?? "");
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setCourses([]);
      setSelectedCourseId("");
      return;
    }
    const supabase = createClient();
    supabase
      .from("courses")
      .select("*")
      .eq("class_id", selectedClassId)
      .order("title")
      .then((res: { data: unknown }) => {
        const nextCourses = (res.data as Course[] | null) ?? [];
        setCourses(nextCourses);
        setSelectedCourseId((current) =>
          current && nextCourses.some((course) => course.id === current)
            ? current
            : (nextCourses[0]?.id ?? "")
        );
      });
  }, [selectedClassId]);

  const fetchMaterials = useCallback(async () => {
    if (!selectedCourseId) {
      setMaterials([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("materials")
      .select("*")
      .eq("course_id", selectedCourseId)
      .order("sort_order");
    setMaterials((data as Material[] | null) ?? []);
    setLoading(false);
  }, [selectedCourseId]);

  useEffect(() => {
    void fetchMaterials();
  }, [fetchMaterials]);

  function openPublishDialog() {
    if (!selectedClassId || !selectedCourseId) {
      setActionError("Select a class and course before publishing materials.");
      return;
    }

    setActionError("");
    setUploadError("");
    setDialogOpen(true);
  }

  function handlePreviewCourse() {
    if (!selectedCourseId) {
      setActionError("Select a course to preview first.");
      return;
    }

    setActionError("");
    window.open(`/courses/${selectedCourseId}`, "_blank", "noopener,noreferrer");
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    const supabase = createClient();
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
    if (!fileUrl || !selectedCourseId || !selectedClassId) return;
    const supabase = createClient();
    const { error } = await supabase.from("materials").insert({
      title,
      course_id: selectedCourseId,
      class_id: selectedClassId,
      type,
      file_url: fileUrl,
      sort_order: materials.length,
    });
    if (error) {
      setUploadError(error.message);
      return;
    }
    setActionError("");
    setDialogOpen(false);
    setTitle("");
    setFileUrl("");
    setType("pdf");
    setUploadError("");
    void fetchMaterials();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this material?")) return;
    const supabase = createClient();
    await supabase.from("materials").delete().eq("id", id);
    void fetchMaterials();
  }

  function reorderByIds(list: Material[], fromId: string, toId: string): Material[] {
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
    const supabase = createClient();
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
        description="Refine the intellectual journey of your students. Manage core instructional texts, pedagogical assets, and research materials within the digital workshop."
        action={
          <>
            <button
              type="button"
              className={stitchSecondaryButtonClass}
              onClick={handlePreviewCourse}
              disabled={!selectedCourseId}
            >
              Preview Course
            </button>
            <button
              type="button"
              className={stitchButtonClass}
              onClick={openPublishDialog}
              disabled={!selectedClassId || !selectedCourseId}
            >
              Publish Changes
            </button>
          </>
        }
      />

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <div className="space-y-6">
          <div className={stitchPanelClass}>
            <p className="stitch-kicker">Pedagogical Framework</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Class</Label>
                <Select value={selectedClassId} onValueChange={(value) => setSelectedClassId(value ?? "")}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select class">
                      {selectedClass
                        ? `${selectedClass.name} (${selectedClass.board})`
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.board})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Course</Label>
                <Select value={selectedCourseId} onValueChange={(value) => setSelectedCourseId(value ?? "")} disabled={!selectedClassId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select course">
                      {selectedCourse ? selectedCourse.title : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-5 rounded-[22px] border border-border bg-muted p-5 text-sm leading-7 text-muted-foreground">
              Use the editor panel to publish PDFs, lecture notes, and seminar
              recordings while keeping the course material stack synchronized.
            </div>
            {actionError ? (
              <div className="mt-4 rounded-[18px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {actionError}
              </div>
            ) : null}
          </div>

          <div className={stitchPanelClass}>
            <div className="flex items-center justify-between">
              <h2 className="text-4xl text-foreground">Required Reading Materials</h2>
              <button type="button" className={stitchSecondaryButtonClass} onClick={openPublishDialog}>
                Add External Link
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className={cn(
                      stitchPanelSoftClass,
                      "flex items-center justify-between gap-4",
                      reordering ? "opacity-70" : "",
                      draggingMaterialId === material.id ? "ring-2 ring-primary/40" : "",
                    )}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => void handleDrop(material.id)}
                  >
                    <div>
                      <p className="text-base text-foreground">{material.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {material.type} • updated {new Date(material.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDraggingMaterialId(material.id)}
                        onDragEnd={() => setDraggingMaterialId(null)}
                        className={cn(stitchSecondaryButtonClass, "px-3")}
                        title="Drag to reorder"
                        disabled={reordering}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <a href={material.file_url} target="_blank" rel="noreferrer" className={stitchSecondaryButtonClass}>
                        Open
                      </a>
                      <button
                        type="button"
                        className="rounded-full border border-destructive/20 px-5 py-3 text-sm text-destructive transition hover:bg-destructive/10"
                        onClick={() => void handleDelete(material.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!materials.length ? (
                  <div className={stitchPanelSoftClass}>
                    <p className="text-sm text-muted-foreground">
                      No assets published yet. Select a class and course, then upload your first file.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className={cn(stitchPanelClass, "border-dashed text-center")}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.03] text-primary">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="mt-6 text-3xl text-foreground">Upload Assets</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Drag and drop PDFs, EPUBs, or high-res workshop diagrams here.
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
                <span>AI Summaries</span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Off</span>
              </div>
              <div className="rounded-[18px] border border-border bg-muted px-4 py-3">
                Tier IV Scholars Only
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
            <DialogTitle>Upload Material</DialogTitle>
            <DialogDescription>Add a PDF, notes file, or video link.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material-title">Title</Label>
              <Input id="material-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType((value ?? "pdf") as MaterialType)}>
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
            {type === "video" ? (
              <div className="space-y-2">
                <Label htmlFor="material-url">Video URL</Label>
                <Input
                  id="material-url"
                  type="url"
                  placeholder="https://..."
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
                    <p className="text-sm text-green-600">File uploaded</p>
                  ) : (
                    <>
                      <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">Drop file or click to browse</p>
                    </>
                  )}
                  <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} className="w-full text-sm" />
                  {uploading ? <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin" /> : null}
                  {uploadError ? <p className="mt-2 text-xs text-destructive">{uploadError}</p> : null}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!fileUrl || uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Upload
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
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <AdminMaterialsPageInner />
    </Suspense>
  );
}

