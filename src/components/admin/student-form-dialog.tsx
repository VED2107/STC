"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CreditCard,
  GraduationCap,
  Loader2,
  Search,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import {
  createStudent,
  getAvailableStudentProfiles,
  type AvailableStudentProfile,
} from "@/app/actions/create-student";
import { uploadStudentPhotoAdmin } from "@/app/actions/upload-student-photo";
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
import { createClient } from "@/lib/supabase/client";
import type { Class, StudentType } from "@/lib/types/database";
import { invalidateAfterStudentMutation } from "@/lib/cache-invalidation";
import { cn } from "@/lib/utils";

interface EditableStudent {
  id: string;
  profile_id: string;
  class_id: string;
  branch_id?: string | null;
  student_type: StudentType;
  is_active: boolean;
  fees_amount: number;
  fees_full_payment_paid: boolean;
  fees_installment1_paid: boolean;
  fees_installment2_paid: boolean;
  profile: { full_name: string; phone: string; avatar_url?: string | null } | null;
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editStudent?: EditableStudent | null;
  initialProfileId?: string | null;
}

const sectionClass =
  "rounded-2xl border border-black/[0.04] bg-gradient-to-br from-white/80 to-muted/30 p-5 space-y-4";
const labelClass =
  "flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground";
const inputClass =
  "stitch-input w-full";
const checkboxClass =
  "h-[18px] w-[18px] rounded-md border-2 border-black/12 bg-white text-primary accent-primary transition focus:ring-2 focus:ring-primary/20";

export function StudentFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editStudent = null,
  initialProfileId = null,
}: StudentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<AvailableStudentProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [classId, setClassId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [studentType, setStudentType] = useState<StudentType>("tuition");
  const [isActive, setIsActive] = useState<"active" | "inactive">("active");
  const [feesAmount, setFeesAmount] = useState("");
  const [feesFullPayment, setFeesFullPayment] = useState(false);
  const [feesInst1, setFeesInst1] = useState(false);
  const [feesInst2, setFeesInst2] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [branchesForClass, setBranchesForClass] = useState<
    Array<{ id: string; name: string; subjects: string[] }>
  >([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = Boolean(editStudent);
  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const selectedProfile = availableProfiles.find((item) => item.id === selectedProfileId) ?? null;
  const filteredProfiles = availableProfiles.filter((profile) => {
    const haystack = `${profile.full_name} ${profile.phone} ${profile.email}`.toLowerCase();
    return haystack.includes(profileSearch.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open) return;

    const supabase = createClient();
    void supabase
      .from("classes")
      .select("*")
      .order("sort_order")
      .then((res: { data: unknown }) => {
        if (res.data) setClasses(res.data as Class[]);
      });

    if (editStudent) {
      setAvailableProfiles([]);
      setSelectedProfileId("");
      setProfileSearch("");
      setFullName(editStudent.profile?.full_name ?? "");
      setPhone(editStudent.profile?.phone ?? "");
      setClassId(editStudent.class_id);
      setBranchId(editStudent.branch_id ?? "");
      setStudentType(editStudent.student_type);
      setIsActive(editStudent.is_active ? "active" : "inactive");
      setFeesAmount(String(editStudent.fees_amount ?? 0));
      setFeesFullPayment(editStudent.fees_full_payment_paid ?? false);
      setFeesInst1(editStudent.fees_installment1_paid ?? false);
      setFeesInst2(editStudent.fees_installment2_paid ?? false);
      setExistingAvatarUrl(editStudent.profile?.avatar_url ?? null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setConfirmDelete(false);
      setDeleting(false);
      return;
    }

    setSelectedProfileId(initialProfileId ?? "");
    setProfileSearch("");
    setFullName("");
    setPhone("");
    setClassId("");
    setBranchId("");
    setStudentType("tuition");
    setIsActive("active");
    setFeesAmount("");
    setFeesFullPayment(false);
    setFeesInst1(false);
    setFeesInst2(false);
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingAvatarUrl(null);

    void (async () => {
      const eligibleProfiles = await getAvailableStudentProfiles();
      setAvailableProfiles(eligibleProfiles);
    })();
  }, [open, editStudent, initialProfileId]);

  useEffect(() => {
    if (!open || !classId) {
      setBranchesForClass([]);
      return;
    }

    async function loadBranches() {
      const supabase = createClient();
      const { data: branchRows } = await supabase
        .from("branches")
        .select("id, class_id, name")
        .eq("class_id", classId)
        .order("name");

      const typed = (branchRows ?? []) as Array<{ id: string; class_id: string; name: string }>;
      if (typed.length === 0) {
        setBranchesForClass([]);
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

      setBranchesForClass(
        typed.map((b) => ({ id: b.id, name: b.name, subjects: subjectMap.get(b.id) ?? [] })),
      );
    }

    void loadBranches();
  }, [open, classId]);

  useEffect(() => {
    if (!feesFullPayment) return;
    setFeesInst1(true);
    setFeesInst2(true);
  }, [feesFullPayment]);

  useEffect(() => {
    if (!isEditMode && selectedProfile) {
      setFullName(selectedProfile.full_name ?? "");
      setPhone(selectedProfile.phone ?? "");
    }
  }, [isEditMode, selectedProfile]);

  useEffect(() => {
    if (isEditMode) return;

    const normalizedSearch = profileSearch.trim().toLowerCase();
    if (!normalizedSearch) return;

    if (filteredProfiles.length === 1 && filteredProfiles[0]?.id !== selectedProfileId) {
      setSelectedProfileId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, isEditMode, profileSearch, selectedProfileId]);

  async function handleDelete() {
    if (!editStudent) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("students").delete().eq("id", editStudent.id);
    setDeleting(false);
    if (error) {
      alert(error.message);
      return;
    }
    setConfirmDelete(false);
    invalidateAfterStudentMutation();
    onOpenChange(false);
    onSuccess();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (isEditMode && editStudent) {
      const supabase = createClient();
      const [profileRes, studentRes] = await Promise.all([
        supabase
          .from("profiles")
          .update({ full_name: fullName, phone })
          .eq("id", editStudent.profile_id),
        supabase
          .from("students")
          .update({
            class_id: classId,
            branch_id: branchId || null,
            student_type: studentType,
            is_active: isActive === "active",
            fees_amount: parseInt(feesAmount || "0", 10) || 0,
            fees_full_payment_paid: feesFullPayment,
            fees_installment1_paid: feesInst1,
            fees_installment2_paid: feesInst2,
          })
          .eq("id", editStudent.id),
      ]);

      if (profileRes.error || studentRes.error) {
        const message =
          profileRes.error?.message ||
          studentRes.error?.message ||
          "Failed to update student account";
        setLoading(false);
        alert(message);
        return;
      }

      setLoading(false);

      if (photoFile && editStudent.profile_id) {
        await uploadPhoto(editStudent.profile_id);
      }

      invalidateAfterStudentMutation();
      onOpenChange(false);
      onSuccess();
      return;
    }

    const result = await createStudent({
      profileId: selectedProfileId,
      classId,
      branchId: branchId || undefined,
      studentType,
      isActive: isActive === "active",
      feesAmount: parseInt(feesAmount || "0", 10) || 0,
      feesFullPaymentPaid: feesFullPayment,
      feesInstallment1Paid: feesInst1,
      feesInstallment2Paid: feesInst2,
    });

    if (!result.success) {
      setLoading(false);
      alert(result.error || "Failed to enroll student");
      return;
    }

    setLoading(false);

    if (photoFile && selectedProfileId) {
      await uploadPhoto(selectedProfileId);
    }

    invalidateAfterStudentMutation();
    onOpenChange(false);
    onSuccess();
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function uploadPhoto(profileId: string) {
    if (!photoFile) return;
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });
      await uploadStudentPhotoAdmin({
        profileId,
        fileName: photoFile.name,
        fileBase64: base64,
        contentType: photoFile.type || "image/jpeg",
      });
    } catch {
      console.error("Photo upload failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3651a5]">
              {isEditMode ? <User className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </span>
            <div>
              <DialogTitle className="text-xl">
                {isEditMode ? "Edit Student" : "Enroll Student"}
              </DialogTitle>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {isEditMode ? "Update profile, class, and access" : "Assign signed-up account to class"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          {/* ── Select student account (enroll mode) ── */}
          {!isEditMode ? (
            <div className={sectionClass}>
              <div className={labelClass}>
                <Search className="h-3.5 w-3.5" />
                Student Account
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={profileSearch}
                  onChange={(event) => setProfileSearch(event.target.value)}
                  placeholder="Search by name, phone, or email"
                  className={cn(inputClass, "pl-10")}
                />
              </div>
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-black/[0.04] bg-white/60 p-2">
                {filteredProfiles.map((profile) => {
                  const isSelected = profile.id === selectedProfileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={cn(
                        "w-full rounded-xl px-3.5 py-2.5 text-left transition-all duration-200",
                        isSelected
                          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <div className="text-sm font-medium">
                        {profile.full_name || "Unnamed student"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[profile.phone, profile.email].filter(Boolean).join(" · ") || profile.id}
                      </div>
                    </button>
                  );
                })}
                {filteredProfiles.length === 0 && availableProfiles.length > 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                    No students match your search.
                  </p>
                ) : null}
              </div>
              {availableProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No signed-up student profiles available to enroll.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ── Personal info ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <User className="h-3.5 w-3.5" />
              Personal Information
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  readOnly={!isEditMode}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  readOnly={!isEditMode}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Photo */}
            <div className="flex items-center gap-4 pt-1">
              <div
                className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-black/8 bg-muted/20 transition hover:border-primary/40 hover:bg-muted/40"
                onClick={() => photoInputRef.current?.click()}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : existingAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={existingAvatarUrl} alt="Current" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-xl border border-black/8 bg-white px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  {photoPreview || existingAvatarUrl ? "Change Photo" : "Upload Photo"}
                </button>
                <p className="mt-1 text-xs text-muted-foreground">
                  {photoFile ? photoFile.name : existingAvatarUrl ? "Current photo set" : "Optional — JPG, PNG"}
                </p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
          </div>

          {/* ── Academic assignment ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <GraduationCap className="h-3.5 w-3.5" />
              Academic Assignment
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Student Type</label>
                <Select
                  value={studentType}
                  onValueChange={(value) => setStudentType((value as StudentType) ?? "tuition")}
                >
                  <SelectTrigger className="h-11 rounded-xl border-black/8 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tuition">Tuition (Offline)</SelectItem>
                    <SelectItem value="online">Online (Course Purchase)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Status</label>
                <Select
                  value={isActive}
                  onValueChange={(value) => setIsActive((value as "active" | "inactive") ?? "active")}
                >
                  <SelectTrigger className="h-11 rounded-xl border-black/8 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Class</label>
              <Select value={classId} onValueChange={(value) => { if (value) { setClassId(value); setBranchId(""); } }}>
                <SelectTrigger className="h-11 rounded-xl border-black/8 bg-white">
                  <SelectValue placeholder="Select class">
                    {selectedClass ? `${selectedClass.name} (${selectedClass.board})` : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {classes.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name} ({classItem.board})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {branchesForClass.length > 0 ? (
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Branch</label>
                <Select
                  value={branchId || "__none"}
                  onValueChange={(value) => setBranchId(!value || value === "__none" ? "" : value)}
                >
                  <SelectTrigger className="h-11 rounded-xl border-black/8 bg-white">
                    <SelectValue placeholder="No branch assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No branch assigned</SelectItem>
                    {branchesForClass.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                        {branch.subjects.length > 0 ? ` (${branch.subjects.join(", ")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Assign a branch under the selected class.
                </p>
              </div>
            ) : null}
          </div>

          {/* ── Fees & installments ── */}
          <div className={sectionClass}>
            <div className={labelClass}>
              <CreditCard className="h-3.5 w-3.5" />
              Fees & Payments
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Fees Amount (INR)</label>
              <input
                type="number"
                min={0}
                value={feesAmount}
                onChange={(e) => setFeesAmount(e.target.value)}
                placeholder="Annual fee amount"
                className={inputClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.04] bg-white/60 px-3.5 py-3 transition hover:bg-white">
                <input
                  type="checkbox"
                  checked={feesFullPayment}
                  onChange={(e) => setFeesFullPayment(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-sm text-foreground">Full Payment</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.04] bg-white/60 px-3.5 py-3 transition hover:bg-white">
                <input
                  type="checkbox"
                  checked={feesInst1}
                  onChange={(e) => setFeesInst1(e.target.checked)}
                  disabled={feesFullPayment}
                  className={checkboxClass}
                />
                <span className="text-sm text-foreground">Installment 1</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.04] bg-white/60 px-3.5 py-3 transition hover:bg-white">
                <input
                  type="checkbox"
                  checked={feesInst2}
                  onChange={(e) => setFeesInst2(e.target.checked)}
                  disabled={feesFullPayment}
                  className={checkboxClass}
                />
                <span className="text-sm text-foreground">Installment 2</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Full payment automatically marks both installments as paid.
            </p>
          </div>

          {/* ── Delete confirmation (edit mode) ── */}
          {isEditMode && confirmDelete ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
              <p className="text-sm font-medium text-destructive">
                Permanently delete {editStudent?.profile?.full_name || "this student"}?
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                This removes the student record, enrollments, attendance, QR tokens, and notifications. Cannot be undone.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-xl border border-black/8 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Yes, Delete Student
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-between border-t border-black/[0.04] pt-5">
            <div>
              {isEditMode && !confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Student
                </button>
              ) : null}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-black/8 bg-white px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  (!isEditMode && (!selectedProfileId || availableProfiles.length === 0))
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditMode ? "Update Student" : "Enroll Student"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
