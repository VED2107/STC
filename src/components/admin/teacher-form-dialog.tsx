"use client";

import { useEffect, useState } from "react";
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
  Camera,
  GraduationCap,
  Loader2,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import type { Branch, Class, Teacher } from "@/lib/types/database";
import { buildTeacherSubjectAccessKey } from "@/lib/teacher-subject-access";
import { resolveUploadContentType, sanitizeUploadFileName } from "@/lib/supabase/upload";
import { invalidateAfterTeacherMutation } from "@/lib/cache-invalidation";
import { cn } from "@/lib/utils";

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

const sectionClass =
  "rounded-2xl border border-black/[0.04] bg-gradient-to-br from-white/80 to-muted/30 p-5 space-y-4";
const labelClass =
  "flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground";
const inputClass = "stitch-input w-full";
const checkboxClass =
  "h-[18px] w-[18px] rounded-md border-2 border-black/12 bg-white text-primary accent-primary transition focus:ring-2 focus:ring-primary/20";

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
  const [branchesByClass, setBranchesByClass] = useState<
    Record<string, Array<{ id: string; name: string; subjects: string[] }>>
  >({});
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
    if (!open || selectedClassIds.length === 0) {
      setBranchesByClass({});
      return;
    }

    async function loadBranches() {
      const supabase = createClient();
      const { data: branchRows } = await supabase
        .from("branches")
        .select("id, class_id, name")
        .in("class_id", selectedClassIds)
        .order("name");

      const typed = (branchRows ?? []) as Array<{ id: string; class_id: string; name: string }>;
      if (typed.length === 0) {
        setBranchesByClass({});
        return;
      }

      const branchIds = typed.map((b) => b.id);
      const { data: subjectRows } = await supabase
        .from("branch_subjects")
        .select("branch_id, subject")
        .in("branch_id", branchIds)
        .order("subject");

      const subjectMap = new Map<string, string[]>();
      for (const row of (subjectRows ?? []) as Array<{ branch_id: string; subject: string }>) {
        const existing = subjectMap.get(row.branch_id) ?? [];
        existing.push(row.subject);
        subjectMap.set(row.branch_id, existing);
      }

      const grouped: Record<string, Array<{ id: string; name: string; subjects: string[] }>> = {};
      for (const branch of typed) {
        const list = grouped[branch.class_id] ?? [];
        list.push({ id: branch.id, name: branch.name, subjects: subjectMap.get(branch.id) ?? [] });
        grouped[branch.class_id] = list;
      }
      setBranchesByClass(grouped);
    }

    void loadBranches();
  }, [open, selectedClassIds]);

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

    if (!nextProfileId) return;

    const { error: clearError } = await supabase
      .from("teacher_class_access")
      .delete()
      .eq("teacher_profile_id", nextProfileId);
    if (clearError) throw clearError;

    if (selectedClassIds.length === 0) return;

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

    if (!nextProfileId) return;

    const { error: clearError } = await supabase
      .from("teacher_subject_access")
      .delete()
      .eq("teacher_profile_id", nextProfileId);
    if (clearError) throw clearError;

    const selectedOptions = classSubjectOptions.filter((item) => selectedSubjectKeys.includes(item.key));
    if (selectedOptions.length === 0) return;

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
      invalidateAfterTeacherMutation();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1edff] text-[#6a4bc4]">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl">
                {editTeacher ? "Edit Teacher" : "New Teacher"}
              </DialogTitle>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {editTeacher ? "Update details and access scope" : "Add new teacher to platform"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          {/* ── Profile details ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <UserCog className="h-3.5 w-3.5" />
              Profile Details
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Qualification</label>
                <input value={qualification} onChange={(e) => setQualification(e.target.value)} required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Subject</label>
              <input value={subject} readOnly placeholder="Select class subjects below" required className={cn(inputClass, "bg-muted/30")} />
              <p className="mt-1 text-xs text-muted-foreground">
                Built from selected class subjects below.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className={cn(inputClass, "resize-none")} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Teacher Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className={inputClass}
              />
              {photoUrl ? (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" />
                  Current photo attached
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Login profile link ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Login Profile
            </div>
            <Select
              value={profileId || "__none"}
              onValueChange={(value) => setProfileId(!value || value === "__none" ? "" : value)}
            >
              <SelectTrigger className="h-11 rounded-xl border-black/8 bg-white">
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

          {/* ── Class & subject access ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <GraduationCap className="h-3.5 w-3.5" />
              Class Access Scope
            </div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-black/[0.04] bg-white/60 p-3">
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes found.</p>
              ) : (
                classes.map((classItem) => (
                  <label key={classItem.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(classItem.id)}
                      onChange={() => toggleClass(classItem.id)}
                      disabled={!profileId}
                      className={checkboxClass}
                    />
                    <span className="text-sm">{classItem.name} ({classItem.board})</span>
                  </label>
                ))
              )}
            </div>
            {!profileId ? (
              <p className="text-xs text-muted-foreground">
                Link a teacher login profile to enable class-level access.
              </p>
            ) : null}
          </div>

          {/* ── Branches (read-only) ── */}
          {Object.keys(branchesByClass).length > 0 ? (
            <div className={sectionClass}>
              <div className={labelClass}>
                <BookOpen className="h-3.5 w-3.5" />
                Branches
              </div>
              <div className="max-h-40 space-y-3 overflow-y-auto rounded-xl border border-black/[0.04] bg-white/60 p-3">
                {selectedClassIds.map((classId) => {
                  const classBranches = branchesByClass[classId];
                  if (!classBranches || classBranches.length === 0) return null;
                  const classItem = classes.find((c) => c.id === classId);
                  return (
                    <div key={classId}>
                      <p className="text-xs font-medium text-muted-foreground">
                        {classItem ? `${classItem.name} (${classItem.board})` : "Class"}
                      </p>
                      {classBranches.map((branch) => (
                        <div key={branch.id} className="ml-3 mt-1">
                          <p className="text-sm">{branch.name}</p>
                          {branch.subjects.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {branch.subjects.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Branches under selected classes. Select subjects below for access.
              </p>
            </div>
          ) : null}

          {/* ── Subject selection ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <BookOpen className="h-3.5 w-3.5" />
              Subject Access
            </div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-black/[0.04] bg-white/60 p-3">
              {selectedClassIds.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Select classes first to load subjects.
                </p>
              ) : classSubjectOptions.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No subjects found for selected classes.
                </p>
              ) : (
                classSubjectOptions.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubjectKeys.includes(item.key)}
                      onChange={() => toggleSubject(item.key)}
                      disabled={!profileId}
                      className={checkboxClass}
                    />
                    <span className="text-sm">
                      {item.subject} — <span className="text-muted-foreground">{item.classLabel}</span>
                    </span>
                  </label>
                ))
              )}
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
              {editTeacher ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
