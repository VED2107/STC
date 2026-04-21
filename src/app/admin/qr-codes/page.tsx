"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Download,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchInputClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import type { Class } from "@/lib/types/database";

interface StudentQrRow {
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  token: string | null;
  token_created_at: string | null;
}

const supabase = createClient();

export default function AdminQrCodesPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<StudentQrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [regeneratingClass, setRegeneratingClass] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const qrCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Confirmation dialog state
  const [confirmRegenStudent, setConfirmRegenStudent] = useState<StudentQrRow | null>(null);
  const [confirmRegenClass, setConfirmRegenClass] = useState(false);

  useEffect(() => {
    if (!authLoading && role !== "admin") {
      router.push(role === "student" ? "/dashboard" : "/admin");
    }
  }, [role, authLoading, router]);

  // Load classes
  useEffect(() => {
    if (role !== "admin") return;
    supabase
      .from("classes")
      .select("*")
      .order("sort_order")
      .then(({ data }: { data: Class[] | null }) => {
        const rows = data ?? [];
        setClasses(rows);
        if (rows.length > 0 && !selectedClassId) {
          setSelectedClassId(rows[0].id);
        }
      });
  }, [role, selectedClassId]);

  const fetchStudents = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    setActionMessage("");

    try {
      const url = `/api/admin/qr-tokens?class_id=${encodeURIComponent(selectedClassId)}`;
      const res = await fetch(url);
      const json = (await res.json()) as { data?: StudentQrRow[] };
      setStudents(json.data ?? []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  // Render QR codes when students change
  useEffect(() => {
    let cancelled = false;

    async function renderQrCodes() {
      const QRCode = (await import("qrcode")).default;

      // Wait a tick for React to commit canvas elements and run ref callbacks
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (cancelled) return;

      for (const student of students) {
        if (!student.token || cancelled) continue;
        const canvas = qrCanvasRefs.current.get(student.student_id);
        if (!canvas) continue;

        try {
          await QRCode.toCanvas(canvas, student.token, {
            width: 180,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
            errorCorrectionLevel: "M",
          });
        } catch {
          // Canvas may have unmounted
        }
      }
    }
    void renderQrCodes();

    return () => {
      cancelled = true;
    };
  }, [students]);

  async function handleGenerateAll() {
    setGeneratingAll(true);
    setActionMessage("");
    try {
      const res = await fetch("/api/admin/qr-tokens", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: selectedClassId }),
      });
      const data = (await res.json()) as {
        generated?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setActionMessage(data.error ?? "Failed to generate QR codes");
        return;
      }
      setActionMessage(
        data.generated
          ? `Generated ${data.generated} new QR code${data.generated > 1 ? "s" : ""}`
          : data.message ?? "All students already have QR codes",
      );
      await fetchStudents();
    } catch {
      setActionMessage("Failed to generate tokens");
    } finally {
      setGeneratingAll(false);
    }
  }

  async function handleRegenerate(studentId: string) {
    setRegeneratingId(studentId);
    setActionMessage("");
    setConfirmRegenStudent(null);
    try {
      const res = await fetch("/api/admin/qr-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionMessage(data.error ?? "Failed to regenerate");
        return;
      }
      await fetchStudents();
      setActionMessage("QR code regenerated — old QR is now invalid");
    } catch {
      setActionMessage("Failed to regenerate");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleRegenerateClass() {
    setRegeneratingClass(true);
    setActionMessage("");
    setConfirmRegenClass(false);
    try {
      const res = await fetch("/api/admin/qr-tokens", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: selectedClassId }),
      });
      const data = (await res.json()) as {
        regenerated?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setActionMessage(data.error ?? "Failed to regenerate class QR codes");
        return;
      }
      setActionMessage(
        data.regenerated
          ? `Regenerated ${data.regenerated} QR code${data.regenerated > 1 ? "s" : ""} for this class`
          : data.message ?? "No QR codes were regenerated",
      );
      await fetchStudents();
    } catch {
      setActionMessage("Failed to regenerate class QR codes");
    } finally {
      setRegeneratingClass(false);
    }
  }

  function handleDownloadQr(studentId: string, studentName: string) {
    const canvas = qrCanvasRefs.current.get(studentId);
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `qr_${studentName.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function formatRegenDate(iso: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const normalizedSearch = search.toLowerCase().trim();
  const filteredStudents = students.filter((s) =>
    s.student_name.toLowerCase().includes(normalizedSearch),
  );
  const withTokenCount = students.filter((s) => s.token).length;

  if (authLoading || role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="QR Management"
        title="Student QR Codes"
        description="Generate, view, and download QR codes for student attendance scanning."
      />

      <div className="mt-8 grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Controls */}
          <div className={stitchPanelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={selectedClassId}
                onValueChange={(v) => { if (v) setSelectedClassId(v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a batch">
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

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(stitchInputClass, "pl-11")}
                  placeholder="Search student…"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className={cn(stitchButtonClass, "gap-2")}
                onClick={() => void handleGenerateAll()}
                disabled={generatingAll || !selectedClassId}
              >
                {generatingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Missing QR Codes
              </button>
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "gap-2")}
                onClick={() => setConfirmRegenClass(true)}
                disabled={regeneratingClass || generatingAll || !selectedClassId || students.length === 0}
              >
                {regeneratingClass ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate Whole Class QR
              </button>
            </div>

            {actionMessage && (
              <p className="mt-4 text-sm text-muted-foreground">
                {actionMessage}
              </p>
            )}
          </div>

          {/* Student grid */}
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className={cn(stitchPanelSoftClass, "text-center")}>
              <QrCode className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-xl text-foreground">
                No students found
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {normalizedSearch
                  ? "No students match your search."
                  : "No active students in this batch."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {filteredStudents.map((student) => (
                <div
                  key={student.student_id}
                  className={cn(
                    stitchPanelSoftClass,
                    "flex flex-col items-center text-center",
                  )}
                >
                  {student.token ? (
                    <canvas
                      ref={(el) => {
                        if (el) {
                          qrCanvasRefs.current.set(student.student_id, el);
                        }
                      }}
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="flex h-[180px] w-[180px] items-center justify-center rounded-lg bg-muted/30">
                      <QrCode className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}

                  <h4 className="mt-4 text-base text-foreground">
                    {student.student_name}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {student.class_name}
                  </p>

                  {/* Token created date */}
                  {student.token_created_at && (
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      Generated: {formatRegenDate(student.token_created_at)}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    {student.token ? (
                      <>
                        <button
                          type="button"
                          className={cn(
                            stitchSecondaryButtonClass,
                            "gap-1.5 text-xs",
                          )}
                          onClick={() =>
                            handleDownloadQr(
                              student.student_id,
                              student.student_name,
                            )
                          }
                        >
                          <Download className="h-3.5 w-3.5" />
                          Save
                        </button>
                        <button
                          type="button"
                          className={cn(
                            stitchSecondaryButtonClass,
                            "gap-1.5 text-xs",
                          )}
                          onClick={() => setConfirmRegenStudent(student)}
                          disabled={regeneratingId === student.student_id}
                        >
                          {regeneratingId === student.student_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Regen
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={cn(stitchButtonClass, "gap-1.5 text-xs")}
                        onClick={() =>
                          void handleRegenerate(student.student_id)
                        }
                        disabled={regeneratingId === student.student_id}
                      >
                        {regeneratingId === student.student_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Generate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-1">
          <div className={stitchPanelClass}>
            <h3 className="text-3xl text-foreground">Summary</h3>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p>
                Batch:{" "}
                <span className="text-foreground">
                  {selectedClass?.name ?? "None"}
                </span>
              </p>
              <p>
                Total Students:{" "}
                <span className="text-foreground">{students.length}</span>
              </p>
              <p>
                QR Generated:{" "}
                <span className="text-foreground">{withTokenCount}</span>
              </p>
              <p>
                Pending:{" "}
                <span className="text-foreground">
                  {students.length - withTokenCount}
                </span>
              </p>
            </div>
          </div>

          <div className={stitchPanelClass}>
            <h3 className="text-3xl text-foreground">How It Works</h3>
            <ol className="mt-5 list-inside list-decimal space-y-3 text-sm leading-7 text-muted-foreground">
              <li>Generate missing QR codes only for students who do not have one yet</li>
              <li>Use whole-class regeneration only when every old QR in the class must be invalidated</li>
              <li>Print or share QR codes with students</li>
              <li>Teachers scan QR on arrival → verify → check-in</li>
              <li>Teachers scan QR on departure → verify → check-out</li>
              <li>Parent gets a WhatsApp notification</li>
            </ol>
          </div>

          <div className={cn(stitchPanelSoftClass, "border-amber-500/20 bg-amber-500/5")}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Regeneration Warning
                </p>
                <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-500/80">
                  Regenerating a QR code immediately invalidates the
                  student&apos;s current physical QR card. Only regenerate if
                  the card is lost or compromised.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Regeneration Confirmation Dialog ---- */}
      {confirmRegenStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Regenerate QR Code?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This will immediately invalidate{" "}
                  <strong>{confirmRegenStudent.student_name}&apos;s</strong>{" "}
                  current QR code. Their existing physical card will stop
                  working. A new QR code will be generated.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                onClick={() =>
                  void handleRegenerate(confirmRegenStudent.student_id)
                }
              >
                Yes, Regenerate
              </button>
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "flex-1")}
                onClick={() => setConfirmRegenStudent(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmRegenClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Regenerate Whole Class QR Codes?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This will invalidate every existing QR code in{" "}
                  <strong>{selectedClass?.name ?? "this class"}</strong>. All students in
                  this class will need newly printed or shared QR codes.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                onClick={() => void handleRegenerateClass()}
              >
                Yes, Regenerate All
              </button>
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "flex-1")}
                onClick={() => setConfirmRegenClass(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
