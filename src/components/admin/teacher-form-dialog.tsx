"use client";

import { useEffect, useState } from "react";
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
import type { Class, Teacher } from "@/lib/types/database";
import { buildTeacherSubjectAccessKey } from "@/lib/teacher-subject-access";
import { resolveUploadContentType, sanitizeUploadFileName } from "@/lib/supabase/upload";

interface TeacherProfileOption {
  id: string;
  full_name: string;
}

interface TeacherFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editTeacher?: Teacher;
}

export function TeacherFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editTeacher,
}: TeacherFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [qualification, setQualification] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [profileId, setProfileId] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [teacherProfiles, setTeacherProfiles] = useState<TeacherProfileOption[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classSubjectOptions, setClassSubjectOptions] = useState<
    Array<{ classId: string; classLabel: string; subject: string; key: string }>
  >([]);
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadSubjectsForClasses(classRows: Class[], classIds: string[]) {
    if (classIds.length === 0) {
      setClassSubjectOptions([]);
      setSelectedSubjectKeys([]);
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("syllabus")
      .select("class_id, subject")
      .in("class_id", classIds)
      .order("subject", { ascending: true });

    const classMap = new Map(classRows.map((row) => [row.id, `${row.name} (${row.board})`]));
    const nextOptions = Array.from(
      new Map(
        ((data as Array<{ class_id: string | null; subject: string | null }> | null) ?? [])
          .filter((row) => row.class_id && row.subject)
          .map((row) => {
            const classId = row.class_id as string;
            const subjectName = row.subject?.trim() ?? "";
            const key = buildTeacherSubjectAccessKey(classId, subjectName);
            return [
              key,
              {
                classId,
                classLabel: classMap.get(classId) ?? "Class",
                subject: subjectName,
                key,
              },
            ];
          }),
      ).values(),
    );

    setClassSubjectOptions(nextOptions);
    setSelectedSubjectKeys((current) =>
      current.filter((item) => nextOptions.some((option) => option.key === item)),
    );
  }

  useEffect(() => {
    if (!open) return;

    const supabase = createClient();

    async function loadFormData() {
      const [classRes, profileRes] = await Promise.all([
        supabase.from("classes").select("*").order("sort_order"),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "teacher")
          .order("full_name"),
      ]);

      setClasses((classRes.data as Class[] | null) ?? []);
      setTeacherProfiles((profileRes.data as TeacherProfileOption[] | null) ?? []);
      const nextClasses = (classRes.data as Class[] | null) ?? [];

      if (editTeacher) {
        setName(editTeacher.name);
        setSubject(editTeacher.subject);
        setSelectedSubjectKeys([]);
        setQualification(editTeacher.qualification);
        setBio(editTeacher.bio || "");
        setPhotoUrl(editTeacher.photo_url ?? null);
        setPhotoFile(null);
        setProfileId(editTeacher.profile_id ?? "");

        if (editTeacher.profile_id) {
          const [{ data: accessData }, { data: subjectAccessData }] = await Promise.all([
            supabase
              .from("teacher_class_access")
              .select("class_id")
              .eq("teacher_profile_id", editTeacher.profile_id),
            supabase
              .from("teacher_subject_access")
              .select("class_id, subject")
              .eq("teacher_profile_id", editTeacher.profile_id),
          ]);
          const nextClassIds =
            ((accessData as { class_id: string }[] | null) ?? []).map((row) => row.class_id);
          setSelectedClassIds(nextClassIds);
          await loadSubjectsForClasses(nextClasses, nextClassIds);
          setSelectedSubjectKeys(
            ((subjectAccessData as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
              buildTeacherSubjectAccessKey(row.class_id, row.subject),
            ),
          );
        } else {
          setSelectedClassIds([]);
          setClassSubjectOptions([]);
        }
      } else {
        setName("");
        setSubject("");
        setSelectedSubjectKeys([]);
        setQualification("");
        setBio("");
        setPhotoUrl(null);
        setPhotoFile(null);
        setProfileId("");
        setSelectedClassIds([]);
        setClassSubjectOptions([]);
      }
    }

    void loadFormData();
  }, [open, editTeacher]);

  useEffect(() => {
    if (!open) return;
    void loadSubjectsForClasses(classes, selectedClassIds);
  }, [classes, open, selectedClassIds]);

  useEffect(() => {
    const summary = Array.from(
      new Set(
        classSubjectOptions
          .filter((item) => selectedSubjectKeys.includes(item.key))
          .map((item) => item.subject),
      ),
    ).join(", ");
    setSubject(summary);
  }, [classSubjectOptions, selectedSubjectKeys]);

  async function uploadTeacherPhoto(teacherId: string) {
    if (!photoFile) return null;
    const supabase = createClient();
    const safeName = sanitizeUploadFileName(photoFile.name);
    const path = `teachers/${teacherId}/photo-${Date.now()}-${safeName}`;
    const contentType = resolveUploadContentType(photoFile, "image/jpeg");

    const { error } = await supabase.storage
      .from("materials")
      .upload(path, photoFile, { upsert: true, contentType });

    if (error) throw error;

    const { data } = supabase.storage.from("materials").getPublicUrl(path);
    return data.publicUrl;
  }

  async function syncTeacherClassAccess(nextProfileId: string, previousProfileId: string | null) {
    const supabase = createClient();

    if (previousProfileId && previousProfileId !== nextProfileId) {
      const { error } = await supabase
        .from("teacher_class_access")
        .delete()
        .eq("teacher_profile_id", previousProfileId);
      if (error) throw error;
    }

    if (!nextProfileId) {
      return;
    }

    const { error: clearError } = await supabase
      .from("teacher_class_access")
      .delete()
      .eq("teacher_profile_id", nextProfileId);
    if (clearError) throw clearError;

    if (selectedClassIds.length === 0) {
      return;
    }

    const { error: insertError } = await supabase.from("teacher_class_access").insert(
      selectedClassIds.map((classId) => ({
        teacher_profile_id: nextProfileId,
        class_id: classId,
      })),
    );
    if (insertError) throw insertError;
  }

  async function syncTeacherSubjectAccess(nextProfileId: string, previousProfileId: string | null) {
    const supabase = createClient();

    if (previousProfileId && previousProfileId !== nextProfileId) {
      const { error } = await supabase
        .from("teacher_subject_access")
        .delete()
        .eq("teacher_profile_id", previousProfileId);
      if (error) throw error;
    }

    if (!nextProfileId) {
      return;
    }

    const { error: clearError } = await supabase
      .from("teacher_subject_access")
      .delete()
      .eq("teacher_profile_id", nextProfileId);
    if (clearError) throw clearError;

    const selectedOptions = classSubjectOptions.filter((item) => selectedSubjectKeys.includes(item.key));
    if (selectedOptions.length === 0) {
      return;
    }

    const { error: insertError } = await supabase.from("teacher_subject_access").insert(
      selectedOptions.map((item) => ({
        teacher_profile_id: nextProfileId,
        class_id: item.classId,
        subject: item.subject,
      })),
    );
    if (insertError) throw insertError;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    const supabase = createClient();

    if (selectedClassIds.length > 0 && selectedSubjectKeys.length === 0) {
      setErrorMessage("Select at least one subject for the assigned classes.");
      setLoading(false);
      return;
    }

    const normalizedProfileId = profileId || null;
    const payload = {
      name,
      subject,
      qualification,
      bio: bio || null,
      photo_url: photoUrl,
      profile_id: normalizedProfileId,
    };

    try {
      if (editTeacher?.id) {
        const { error: updateError } = await supabase
          .from("teachers")
          .update(payload)
          .eq("id", editTeacher.id);
        if (updateError) throw updateError;

        if (photoFile) {
          const newPhotoUrl = await uploadTeacherPhoto(editTeacher.id);
          if (newPhotoUrl) {
            const { error: photoUpdateError } = await supabase
              .from("teachers")
              .update({ photo_url: newPhotoUrl })
              .eq("id", editTeacher.id);
            if (photoUpdateError) throw photoUpdateError;
            setPhotoUrl(newPhotoUrl);
          }
        }

        await syncTeacherClassAccess(profileId, editTeacher.profile_id);
        await syncTeacherSubjectAccess(profileId, editTeacher.profile_id);
      } else {
        const { data, error } = await supabase
          .from("teachers")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;

        const newTeacherId = (data as { id: string } | null)?.id;
        if (newTeacherId && photoFile) {
          const newPhotoUrl = await uploadTeacherPhoto(newTeacherId);
          if (newPhotoUrl) {
            const { error: photoUpdateError } = await supabase
              .from("teachers")
              .update({ photo_url: newPhotoUrl })
              .eq("id", newTeacherId);
            if (photoUpdateError) throw photoUpdateError;
            setPhotoUrl(newPhotoUrl);
          }
        }

        await syncTeacherClassAccess(profileId, null);
        await syncTeacherSubjectAccess(profileId, null);
      }
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Failed to save teacher. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  function toggleClass(classId: string) {
    setSelectedClassIds((previous) =>
      previous.includes(classId)
        ? previous.filter((id) => id !== classId)
        : [...previous, classId],
    );
  }

  function toggleSubject(subjectKey: string) {
    setSelectedSubjectKeys((previous) =>
      previous.includes(subjectKey)
        ? previous.filter((item) => item !== subjectKey)
        : [...previous, subjectKey],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editTeacher ? "Edit Teacher" : "New Teacher"}</DialogTitle>
          <DialogDescription>
            {editTeacher ? "Update teacher details and access scope." : "Add a new teacher to the platform."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tf-name">Name</Label>
            <Input id="tf-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-subject">Subject</Label>
            <Input id="tf-subject" value={subject} readOnly placeholder="Select class subjects below" required />
            <p className="text-xs text-muted-foreground">
              Subject assignment is built from the selected class subjects below.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-qual">Qualification</Label>
            <Input id="tf-qual" value={qualification} onChange={(e) => setQualification(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-bio">Bio</Label>
            <Textarea id="tf-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf-photo">Teacher Photo</Label>
            <Input
              id="tf-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
            {photoUrl ? <p className="text-xs text-muted-foreground">Current photo attached.</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Teacher Login Profile</Label>
            <Select
              value={profileId || "__none"}
              onValueChange={(value) => setProfileId(!value || value === "__none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not linked to a login profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Not linked</SelectItem>
                {teacherProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name || profile.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class Access Scope</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes found.</p>
              ) : (
                classes.map((classItem) => (
                  <label key={classItem.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(classItem.id)}
                      onChange={() => toggleClass(classItem.id)}
                      disabled={!profileId}
                    />
                    <span>
                      {classItem.name} ({classItem.board})
                    </span>
                  </label>
                ))
              )}
            </div>
            {!profileId ? (
              <p className="text-xs text-muted-foreground">
                Link a teacher login profile to enable class-level access assignment.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Subjects For Selected Classes</Label>
            <div className="max-h-40 space-y-3 overflow-y-auto rounded-md border p-3">
              {selectedClassIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Select classes first to load their subjects.
                </p>
              ) : classSubjectOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No subjects found yet for the selected classes.
                </p>
              ) : (
                classSubjectOptions.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubjectKeys.includes(item.key)}
                      onChange={() => toggleSubject(item.key)}
                      disabled={!profileId}
                    />
                    <span>
                      {item.subject} - {item.classLabel}
                    </span>
                  </label>
                ))
              )}
            </div>
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
              {editTeacher ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
