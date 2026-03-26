"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { createStudent } from "@/app/actions/create-student";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [classId, setClassId] = useState("");
  const [studentType, setStudentType] = useState<StudentType>("tuition");
  const [isActive, setIsActive] = useState<"active" | "inactive">("active");
  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const isEditMode = Boolean(editStudent);

  useEffect(() => {
    if (open) {
      const supabase = createClient();
      supabase
        .from("classes")
        .select("*")
        .order("sort_order")
        .then((res: { data: unknown }) => {
          if (res.data) setClasses(res.data as Class[]);
        });

      if (editStudent) {
        setFullName(editStudent.profile?.full_name ?? "");
        setPhone(editStudent.profile?.phone ?? "");
        setEmail("");
        setClassId(editStudent.class_id);
        setStudentType(editStudent.student_type);
        setIsActive(editStudent.is_active ? "active" : "inactive");
      } else {
        setFullName("");
        setPhone("");
        setEmail("");
        setClassId("");
        setStudentType("tuition");
        setIsActive("active");
      }
    }
  }, [open, editStudent]);

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
      fullName,
      email,
      phone,
      classId,
      studentType,
    });

    if (!result.success) {
      setLoading(false);
      alert(result.error || "Failed to create student account");
      return;
    }

    try {
      await fetch("/api/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: fullName,
          confirmUrl: `${window.location.origin}/login`,
        }),
      });
    } catch {
      // Non-blocking: signup succeeds even if email fails.
    }

    setLoading(false);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Student" : "Add Student"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update student profile, class mapping, and access mode."
              : "Create a new student account. They will receive a verification email."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sf-name">Full Name</Label>
            <Input
              id="sf-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {!isEditMode ? (
            <div className="space-y-2">
              <Label htmlFor="sf-email">Email</Label>
              <Input
                id="sf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="sf-phone">Phone</Label>
            <Input
              id="sf-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Student Type</Label>
            <Select
              value={studentType}
              onValueChange={(v) =>
                setStudentType((v as StudentType) ?? "tuition")
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
              onValueChange={(v) =>
                setIsActive((v as "active" | "inactive") ?? "active")
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Update Student" : "Add Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
