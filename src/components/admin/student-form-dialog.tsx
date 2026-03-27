"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createStudent,
  getAvailableStudentProfiles,
  type AvailableStudentProfile,
} from "@/app/actions/create-student";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Class, StudentType } from "@/lib/types/database";

interface EditableStudent {
  id: string;
  profile_id: string;
  class_id: string;
  student_type: StudentType;
  is_active: boolean;
  profile: { full_name: string; phone: string } | null;
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editStudent?: EditableStudent | null;
}

export function StudentFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editStudent = null,
}: StudentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<AvailableStudentProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [classId, setClassId] = useState("");
  const [studentType, setStudentType] = useState<StudentType>("tuition");
  const [isActive, setIsActive] = useState<"active" | "inactive">("active");
  const isEditMode = Boolean(editStudent);
  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const selectedProfile = availableProfiles.find((item) => item.id === selectedProfileId) ?? null;
  const filteredProfiles = availableProfiles.filter((profile) => {
    const haystack = `${profile.full_name} ${profile.phone}`.toLowerCase();
    return haystack.includes(profileSearch.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open) {
      return;
    }

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
      setStudentType(editStudent.student_type);
      setIsActive(editStudent.is_active ? "active" : "inactive");
      return;
    }

    setSelectedProfileId("");
    setProfileSearch("");
    setFullName("");
    setPhone("");
    setClassId("");
    setStudentType("tuition");
    setIsActive("active");

    void (async () => {
      const eligibleProfiles = await getAvailableStudentProfiles();
      setAvailableProfiles(eligibleProfiles);
    })();
  }, [open, editStudent]);

  useEffect(() => {
    if (!isEditMode && selectedProfile) {
      setFullName(selectedProfile.full_name ?? "");
      setPhone(selectedProfile.phone ?? "");
    }
  }, [isEditMode, selectedProfile]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const normalizedSearch = profileSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return;
    }

    if (filteredProfiles.length === 1 && filteredProfiles[0]?.id !== selectedProfileId) {
      setSelectedProfileId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, isEditMode, profileSearch, selectedProfileId]);

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
            student_type: studentType,
            is_active: isActive === "active",
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
      onOpenChange(false);
      onSuccess();
      return;
    }

    const result = await createStudent({
      profileId: selectedProfileId,
      classId,
      studentType,
      isActive: isActive === "active",
    });

    if (!result.success) {
      setLoading(false);
      alert(result.error || "Failed to enroll student");
      return;
    }

    setLoading(false);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Student" : "Enroll Signed-Up Student"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update student profile, class mapping, and access mode."
              : "Only existing signed-up student accounts can be added to the student registry."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditMode ? (
            <div className="space-y-2">
              <Label>Student Account</Label>
              <Input
                value={profileSearch}
                onChange={(event) => setProfileSearch(event.target.value)}
                placeholder="Search signed-up students by name or phone"
              />
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-input p-2">
                {filteredProfiles.map((profile) => {
                  const isSelected = profile.id === selectedProfileId;

                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={`w-full rounded-md px-3 py-2 text-left transition ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="text-sm font-medium">
                        {profile.full_name || "Unnamed student"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {profile.phone || profile.id}
                      </div>
                    </button>
                  );
                })}
                {filteredProfiles.length === 0 && availableProfiles.length > 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    No students match your search.
                  </p>
                ) : null}
              </div>
              {availableProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No signed-up student profiles are available to enroll yet.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="sf-name">Full Name</Label>
            <Input
              id="sf-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              readOnly={!isEditMode}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-phone">Phone</Label>
            <Input
              id="sf-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly={!isEditMode}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Student Type</Label>
            <Select
              value={studentType}
              onValueChange={(value) =>
                setStudentType((value as StudentType) ?? "tuition")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tuition">Tuition (Offline)</SelectItem>
                <SelectItem value="online">Online (Course Purchase)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={isActive}
              onValueChange={(value) =>
                setIsActive((value as "active" | "inactive") ?? "active")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(value) => value && setClassId(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select class">
                  {selectedClass
                    ? `${selectedClass.name} (${selectedClass.board})`
                    : undefined}
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                (!isEditMode && (!selectedProfileId || availableProfiles.length === 0))
              }
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Update Student" : "Enroll Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
