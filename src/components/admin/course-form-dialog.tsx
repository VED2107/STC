"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  CreditCard,
  FileText,
  Image,
  Loader2,
  PlayCircle,
  Video,
} from "lucide-react";
import type { Class, Course } from "@/lib/types/database";
import type { Database } from "@/lib/types/supabase";
import { resolveUploadContentType, sanitizeUploadFileName } from "@/lib/supabase/upload";
import { invalidateAfterCourseMutation } from "@/lib/cache-invalidation";
import { cn } from "@/lib/utils";

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editCourse?: Partial<Course> & { id?: string };
}

type CourseInsert = Database["public"]["Tables"]["courses"]["Insert"];
type CourseUpdate = Database["public"]["Tables"]["courses"]["Update"];

const sectionClass =
  "rounded-2xl border border-black/[0.04] bg-gradient-to-br from-white/80 to-muted/30 p-5 space-y-4";
const labelClass =
  "flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground";
const inputClass = "stitch-input w-full";
const checkboxClass =
  "h-[18px] w-[18px] rounded-md border-2 border-black/12 bg-white text-primary accent-primary transition focus:ring-2 focus:ring-primary/20";

export function CourseFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editCourse,
}: CourseFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [classId, setClassId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [videoLink, setVideoLink] = useState("");
  const [feeInr, setFeeInr] = useState("0");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const selectedClass = classes.find((item) => item.id === classId) ?? null;

  useEffect(() => {
    if (open) {
      const supabase = createClient();
      supabase.from("classes").select("*").order("sort_order").then((res: { data: unknown }) => {
        if (res.data) setClasses(res.data as Class[]);
      });

      if (editCourse) {
        setTitle(editCourse.title || "");
        setDescription(editCourse.description || "");
        setSubject(editCourse.subject || "");
        setClassId(editCourse.class_id || "");
        setIsActive(editCourse.is_active ?? true);
        setVideoLink((editCourse as Record<string, string | null>).video_link || "");
        setFeeInr(String((editCourse as Record<string, number | null>).fee_inr ?? 0));
        setPdfUrl((editCourse as Record<string, string | null>).pdf_url ?? null);
        setPdfFile(null);
        setThumbnailUrl((editCourse as Record<string, string | null>).thumbnail_url ?? null);
        setThumbnailFile(null);
      } else {
        setTitle(""); setDescription(""); setSubject("");
        setClassId(""); setIsActive(true);
        setVideoLink("");
        setFeeInr("0");
        setPdfUrl(null);
        setPdfFile(null);
        setThumbnailUrl(null);
        setThumbnailFile(null);
      }
    }
  }, [open, editCourse]);

  async function uploadPdf(courseId: string) {
    if (!pdfFile) return null;
    const supabase = createClient();
    const safeName = sanitizeUploadFileName(pdfFile.name);
    const path = `courses/${courseId}/${Date.now()}-${safeName}`;
    const contentType = resolveUploadContentType(pdfFile, "application/pdf");

    const { error } = await supabase.storage
      .from("materials")
      .upload(path, pdfFile, { upsert: true, contentType });

    if (error) throw error;

    const { data } = supabase.storage.from("materials").getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadThumbnail(courseId: string) {
    if (!thumbnailFile) return null;
    const supabase = createClient();
    const safeName = sanitizeUploadFileName(thumbnailFile.name);
    const path = `courses/${courseId}/thumbnail-${Date.now()}-${safeName}`;
    const contentType = resolveUploadContentType(thumbnailFile, "image/jpeg");

    const { error } = await supabase.storage
      .from("materials")
      .upload(path, thumbnailFile, { upsert: true, contentType });

    if (error) throw error;

    const { data } = supabase.storage.from("materials").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    const supabase = createClient();
    if (!classId) {
      setErrorMessage("Please select a class before saving.");
      setLoading(false);
      return;
    }

    const parsedFee = Number.parseInt(feeInr || "0", 10);
    const normalizedFee = Number.isFinite(parsedFee) && parsedFee >= 0 ? parsedFee : 0;

    const payload: CourseInsert = {
      title,
      description,
      subject,
      class_id: classId,
      is_online_only: true,
      teacher_id: null,
      is_active: isActive,
      video_link: videoLink.trim() ? videoLink.trim() : null,
      fee_inr: normalizedFee,
      pdf_url: pdfUrl,
      thumbnail_url: thumbnailUrl,
    };

    try {
      if (editCourse?.id) {
        const updatePayload: CourseUpdate = payload;
        const { error: updateError } = await supabase
          .from("courses")
          .update(updatePayload)
          .eq("id", editCourse.id);
        if (updateError) throw updateError;

        if (thumbnailFile) {
          const newThumbUrl = await uploadThumbnail(editCourse.id);
          if (newThumbUrl) {
            const { error: thumbUpdateError } = await supabase
              .from("courses")
              .update({ thumbnail_url: newThumbUrl })
              .eq("id", editCourse.id);
            if (thumbUpdateError) throw thumbUpdateError;
            setThumbnailUrl(newThumbUrl);
          }
        }

        if (pdfFile) {
          const newPdfUrl = await uploadPdf(editCourse.id);
          if (newPdfUrl) {
            const { error: pdfUpdateError } = await supabase
              .from("courses")
              .update({ pdf_url: newPdfUrl })
              .eq("id", editCourse.id);
            if (pdfUpdateError) throw pdfUpdateError;
            setPdfUrl(newPdfUrl);
          }
        }
      } else {
        const { data, error } = await supabase
          .from("courses")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;

        const newCourseId = (data as { id: string } | null)?.id;
        if (newCourseId) {
          if (thumbnailFile) {
            const newThumbUrl = await uploadThumbnail(newCourseId);
            if (newThumbUrl) {
              const { error: thumbUpdateError } = await supabase
                .from("courses")
                .update({ thumbnail_url: newThumbUrl })
                .eq("id", newCourseId);
              if (thumbUpdateError) throw thumbUpdateError;
              setThumbnailUrl(newThumbUrl);
            }
          }

          if (pdfFile) {
            const newPdfUrl = await uploadPdf(newCourseId);
            if (newPdfUrl) {
              const { error: pdfUpdateError } = await supabase
                .from("courses")
                .update({ pdf_url: newPdfUrl })
                .eq("id", newCourseId);
              if (pdfUpdateError) throw pdfUpdateError;
              setPdfUrl(newPdfUrl);
            }
          }
        }
      }
      invalidateAfterCourseMutation();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Upload failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d0e9d4]/55 text-[#374c3d]">
              <PlayCircle className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl">
                {editCourse?.id ? "Edit Course" : "New Course"}
              </DialogTitle>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {editCourse?.id ? "Update online course details" : "Create online subject for students"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          {/* ── Course details ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <BookOpen className="h-3.5 w-3.5" />
              Course Details
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Course Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} required className={inputClass} />
                <p className="mt-1 text-xs text-muted-foreground">Online course label only.</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cn(inputClass, "resize-none")} />
            </div>
          </div>

          {/* ── Pricing & class ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <CreditCard className="h-3.5 w-3.5" />
              Pricing & Classification
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Online Student Fee (₹)</label>
                <input
                  inputMode="numeric"
                  value={feeInr}
                  onChange={(e) => setFeeInr(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="0"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">Online students only.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Show Under Class</label>
                <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
                  <SelectTrigger className="h-11 rounded-xl border-black/8 bg-white">
                    <SelectValue placeholder="Select class">
                      {selectedClass ? `${selectedClass.name} (${selectedClass.board})` : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.board})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.04] bg-white/60 px-3.5 py-3 transition hover:bg-white">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className={checkboxClass}
              />
              <span className="text-sm text-foreground">Active — visible to students</span>
            </label>
          </div>

          {/* ── Media attachments ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <Video className="h-3.5 w-3.5" />
              Media & Attachments
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Video Link</label>
              <input
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Image className="h-3.5 w-3.5" />
                  Thumbnail
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                  className={inputClass}
                />
                {thumbnailUrl ? (
                  <p className="mt-1 text-xs text-muted-foreground">Current thumbnail attached.</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Course PDF
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className={inputClass}
                />
                {pdfUrl ? (
                  <p className="mt-1 text-xs text-muted-foreground">Current PDF attached.</p>
                ) : null}
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-2.5 border-t border-black/[0.04] pt-5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-black/8 bg-white px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editCourse?.id ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
