"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Loader2 } from "lucide-react";
import type { Class, Teacher, Course } from "@/lib/types/database";
import { resolveUploadContentType, sanitizeUploadFileName } from "@/lib/supabase/upload";

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editCourse?: Partial<Course> & { id?: string };
}

export function CourseFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editCourse,
}: CourseFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [videoLink, setVideoLink] = useState("");
  const [feeInr, setFeeInr] = useState("0");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const selectedTeacher = teachers.find((item) => item.id === teacherId) ?? null;

  useEffect(() => {
    if (open) {
      const supabase = createClient();
      supabase.from("classes").select("*").order("sort_order").then((res: { data: unknown }) => {
        if (res.data) setClasses(res.data as Class[]);
      });
      supabase.from("teachers").select("*").order("name").then((res: { data: unknown }) => {
        if (res.data) setTeachers(res.data as Teacher[]);
      });

      if (editCourse) {
        setTitle(editCourse.title || "");
        setDescription(editCourse.description || "");
        setSubject(editCourse.subject || "");
        setClassId(editCourse.class_id || "");
        setTeacherId((editCourse as Record<string, string>).teacher_id || "");
        setIsActive(editCourse.is_active ?? true);
        setVideoLink((editCourse as Record<string, string | null>).video_link || "");
        setFeeInr(String((editCourse as Record<string, number | null>).fee_inr ?? 0));
        setPdfUrl((editCourse as Record<string, string | null>).pdf_url ?? null);
        setPdfFile(null);
        setThumbnailUrl((editCourse as Record<string, string | null>).thumbnail_url ?? null);
        setThumbnailFile(null);
      } else {
        setTitle(""); setDescription(""); setSubject("");
        setClassId(""); setTeacherId(""); setIsActive(true);
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

    const payload = {
      title,
      description,
      subject,
      class_id: classId || null,
      teacher_id: teacherId || null,
      is_active: isActive,
      video_link: videoLink.trim() ? videoLink.trim() : null,
      fee_inr: normalizedFee,
      pdf_url: pdfUrl,
      thumbnail_url: thumbnailUrl,
    };

    try {
      if (editCourse?.id) {
        const { error: updateError } = await supabase
          .from("courses")
          .update(payload)
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

        if (error) {
          throw error;
        }

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editCourse?.id ? "Edit Course" : "New Course"}</DialogTitle>
          <DialogDescription>
            {editCourse?.id ? "Update the course details." : "Create a new course for a class."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-title">Title</Label>
            <Input id="cf-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-subject">Subject</Label>
            <Input id="cf-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-fee">Course Fee (₹)</Label>
            <Input
              id="cf-fee"
              inputMode="numeric"
              value={feeInr}
              onChange={(e) => setFeeInr(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-desc">Description</Label>
            <Textarea id="cf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-video">Video Link</Label>
            <Input
              id="cf-video"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-thumb">Thumbnail Image</Label>
            <Input
              id="cf-thumb"
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
            />
            {thumbnailUrl ? (
              <p className="text-xs text-muted-foreground">Current thumbnail attached.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-pdf">Course PDF</Label>
            <Input
              id="cf-pdf"
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
            {pdfUrl ? (
              <p className="text-xs text-muted-foreground">Current PDF attached.</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class">
                    {selectedClass
                      ? `${selectedClass.name} (${selectedClass.board})`
                      : undefined}
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
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={teacherId} onValueChange={(v) => v && setTeacherId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher">
                    {selectedTeacher ? selectedTeacher.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cf-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="cf-active" className="text-sm">Active</Label>
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editCourse?.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
