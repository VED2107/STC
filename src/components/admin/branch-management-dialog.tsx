"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitBranch, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Branch } from "@/lib/types/database";
import { cn } from "@/lib/utils";

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

const sectionClass =
  "rounded-2xl border border-black/[0.04] bg-gradient-to-br from-white/80 to-muted/30 p-5 space-y-4";
const labelClass =
  "flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground";
const inputClass = "stitch-input w-full";
const checkboxClass =
  "h-[18px] w-[18px] rounded-md border-2 border-black/12 bg-white text-primary accent-primary transition focus:ring-2 focus:ring-primary/20";

const supabase = createClient();

export function BranchManagementDialog({
  open,
  onOpenChange,
  classId,
  className: classDisplayName,
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
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1edff] text-[#6a4bc4]">
              <GitBranch className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl">Branches</DialogTitle>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {classDisplayName}
              </p>
            </div>
          </div>
        </DialogHeader>

        {formMode === "list" ? (
          <div className="mt-2 space-y-5">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : branches.length === 0 ? (
              <div className={cn(sectionClass, "py-8 text-center")}>
                <GitBranch className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No branches yet. Create one to subdivide this class.
                </p>
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-start justify-between rounded-2xl border border-black/[0.04] bg-gradient-to-br from-white/80 to-muted/20 p-4 transition hover:border-black/8"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{branch.name}</p>
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
                        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(branch.id)}
                        className="rounded-lg p-1.5 text-destructive/60 transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="flex justify-end gap-2.5 border-t border-black/[0.04] pt-5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-black/8 bg-white px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Close
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-105"
              >
                <Plus className="h-4 w-4" />
                Add Branch
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormMode("list")}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-foreground">
                {formMode === "edit" ? "Edit Branch" : "New Branch"}
              </span>
            </div>

            <div className={sectionClass}>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Branch Name</label>
                <input
                  placeholder="e.g. Science, Commerce, Arts"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <div className={labelClass}>
                  <GitBranch className="h-3.5 w-3.5" />
                  Subjects
                </div>
                {classSubjects.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No subjects defined for this class yet.
                  </p>
                ) : (
                  <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-black/[0.04] bg-white/60 p-3">
                    {classSubjects.map((subject) => (
                      <label key={subject} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={formSelectedSubjects.includes(subject)}
                          onChange={() => toggleSubject(subject)}
                          className={checkboxClass}
                        />
                        <span className="text-sm">{subject}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2.5 border-t border-black/[0.04] pt-5">
              <button
                type="button"
                onClick={() => setFormMode("list")}
                className="rounded-xl border border-black/8 bg-white px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !formName.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {formMode === "edit" ? "Update" : "Create"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
