"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Branch } from "@/lib/types/database";

interface BranchManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  classSubjects: string[];
  onBranchesChanged: () => void;
}

interface BranchWithSubjects extends Branch {
  subjects: string[];
}

const supabase = createClient();

export function BranchManagementDialog({
  open,
  onOpenChange,
  classId,
  className,
  classSubjects,
  onBranchesChanged,
}: BranchManagementDialogProps) {
  const [branches, setBranches] = useState<BranchWithSubjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formMode, setFormMode] = useState<"list" | "add" | "edit">("list");
  const [editingBranch, setEditingBranch] = useState<BranchWithSubjects | null>(null);
  const [formName, setFormName] = useState("");
  const [formSelectedSubjects, setFormSelectedSubjects] = useState<string[]>([]);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    const { data: branchRows, error: branchError } = await supabase
      .from("branches")
      .select("*")
      .eq("class_id", classId)
      .order("name");

    if (branchError) {
      setError(branchError.message);
      setLoading(false);
      return;
    }

    const typedBranches = (branchRows ?? []) as Branch[];
    if (typedBranches.length === 0) {
      setBranches([]);
      setLoading(false);
      return;
    }

    const branchIds = typedBranches.map((b) => b.id);
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

    setBranches(
      typedBranches.map((b) => ({
        ...b,
        subjects: subjectMap.get(b.id) ?? [],
      })),
    );
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    if (open) {
      setFormMode("list");
      setError("");
      void loadBranches();
    }
  }, [open, loadBranches]);

  function openAdd() {
    setEditingBranch(null);
    setFormName("");
    setFormSelectedSubjects([]);
    setError("");
    setFormMode("add");
  }

  function openEdit(branch: BranchWithSubjects) {
    setEditingBranch(branch);
    setFormName(branch.name);
    setFormSelectedSubjects([...branch.subjects]);
    setError("");
    setFormMode("edit");
  }

  function toggleSubject(subject: string) {
    setFormSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  async function handleSave() {
    const trimmedName = formName.trim();
    if (!trimmedName) return;
    setSaving(true);
    setError("");

    try {
      if (formMode === "edit" && editingBranch) {
        const { error: updateError } = await supabase
          .from("branches")
          .update({ name: trimmedName })
          .eq("id", editingBranch.id);
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from("branch_subjects")
          .delete()
          .eq("branch_id", editingBranch.id);
        if (deleteError) throw deleteError;

        if (formSelectedSubjects.length > 0) {
          const { error: insertError } = await supabase.from("branch_subjects").insert(
            formSelectedSubjects.map((subject) => ({
              branch_id: editingBranch.id,
              subject,
            })),
          );
          if (insertError) throw insertError;
        }
      } else {
        const { data: created, error: insertError } = await supabase
          .from("branches")
          .insert({ class_id: classId, name: trimmedName })
          .select("id")
          .single();
        if (insertError) throw insertError;

        if (created?.id && formSelectedSubjects.length > 0) {
          const { error: subjectError } = await supabase.from("branch_subjects").insert(
            formSelectedSubjects.map((subject) => ({
              branch_id: (created as { id: string }).id,
              subject,
            })),
          );
          if (subjectError) throw subjectError;
        }
      }

      await loadBranches();
      onBranchesChanged();
      setFormMode("list");
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to save branch.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(branchId: string) {
    if (!confirm("Delete this branch?")) return;
    const { error: deleteError } = await supabase.from("branches").delete().eq("id", branchId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await loadBranches();
    onBranchesChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Branches — {className}</DialogTitle>
        </DialogHeader>

        {formMode === "list" ? (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : branches.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No branches yet. Create one to subdivide this class.
              </p>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{branch.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {branch.subjects.length > 0
                          ? branch.subjects.join(", ")
                          : "No subjects assigned"}
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(branch)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(branch.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={openAdd} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Branch
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormMode("list")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                {formMode === "edit" ? "Edit Branch" : "New Branch"}
              </span>
            </div>
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input
                placeholder="e.g. Science, Commerce, Arts"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subjects</Label>
              {classSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No subjects defined for this class yet. Add subjects to the class first.
                </p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                  {classSubjects.map((subject) => (
                    <label key={subject} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formSelectedSubjects.includes(subject)}
                        onChange={() => toggleSubject(subject)}
                      />
                      <span>{subject}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormMode("list")}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={saving || !formName.trim()}
                className="gap-1.5"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {formMode === "edit" ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
