"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Loader2,
  QrCode,
  CheckCircle2,
  RefreshCw,
  ScanLine,
  User,
  XCircle,
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
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import type { Class } from "@/lib/types/database";

const QRScannerWidget = dynamic(() => import("@/components/qr-scanner"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[250px] items-center justify-center rounded-xl bg-black/50">
      <LoadingAnimation size="md" />
    </div>
  ),
});

interface CourseForScanner {
  id: string;
  title: string;
  subject: string;
  class_id: string;
}

interface AttendanceSession {
  id: string;
  classId: string;
  courseId: string | null;
  subject: string;
  sessionDate: string;
  isActive: boolean;
  className: string;
  courseTitle: string | null;
}

interface ScanResult {
  status: "checked_in" | "checked_out" | "already_done";
  studentName: string;
  className: string;
  subject: string;
  sessionDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  message: string;
}

interface ScanHistoryEntry extends ScanResult {
  timestamp: number;
}

function formatClock(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function playFeedback(status: ScanResult["status"]) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.12;

    if (status === "checked_in") {
      osc.frequency.value = 860;
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (status === "checked_out") {
      osc.frequency.value = 620;
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.value = 360;
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    }
  } catch {
    // Ignore audio support issues.
  }
}

export default function QrScanPage() {
  const router = useRouter();
  const { role, loading: authLoading, user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<CourseForScanner[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("general");
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scanError, setScanError] = useState("");
  const [latestResult, setLatestResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ScanResult | null>(null);

  const lastScanRef = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  useEffect(() => {
    if (!authLoading && role === "student") {
      router.push("/dashboard");
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (role !== "teacher" && role !== "admin") return;
    const supabase = createClient();

    async function loadBaseData() {
      if (role === "teacher" && user?.id) {
        const { data: accessRows, error: accessError } = await supabase
          .from("teacher_class_access")
          .select("class_id")
          .eq("teacher_profile_id", user.id);

        if (accessError) {
          setScannerError("Unable to load your assigned classes.");
          return;
        }

        const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map(
          (row) => row.class_id,
        );

        if (classIds.length === 0) {
          setClasses([]);
          setCourses([]);
          return;
        }

        const [classesRes, coursesRes] = await Promise.all([
          supabase.from("classes").select("*").in("id", classIds).order("sort_order"),
          supabase
            .from("courses")
            .select("id, title, subject, class_id")
            .in("class_id", classIds)
            .order("title"),
        ]);

        if (classesRes.error || coursesRes.error) {
          setScannerError("Unable to load scanner setup.");
          return;
        }

        setClasses((classesRes.data as Class[] | null) ?? []);
        setCourses((coursesRes.data as CourseForScanner[] | null) ?? []);
        return;
      }

      const [classesRes, coursesRes] = await Promise.all([
        supabase.from("classes").select("*").order("sort_order"),
        supabase
          .from("courses")
          .select("id, title, subject, class_id")
          .order("title"),
      ]);

      if (classesRes.error || coursesRes.error) {
        setScannerError("Unable to load scanner setup.");
        return;
      }

      setClasses((classesRes.data as Class[] | null) ?? []);
      setCourses((coursesRes.data as CourseForScanner[] | null) ?? []);
    }

    void loadBaseData();
  }, [role, user?.id]);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const classCourses = useMemo(
    () => courses.filter((course) => course.class_id === selectedClassId),
    [courses, selectedClassId],
  );

  useEffect(() => {
    const currentValueIsValid =
      selectedCourseId === "general" ||
      classCourses.some((course) => course.id === selectedCourseId);

    if (!currentValueIsValid) {
      setSelectedCourseId("general");
    }
  }, [classCourses, selectedCourseId]);

  const loadTodaySessions = useCallback(async () => {
    const res = await fetch("/api/attendance/sessions");
    const json = (await res.json()) as { data?: AttendanceSession[]; error?: string };

    if (!res.ok) {
      setScannerError(json.error ?? "Unable to load today’s sessions.");
      return;
    }

    const sessions = json.data ?? [];
    const desiredCourseId = selectedCourseId === "general" ? null : selectedCourseId;

    const matched =
      sessions.find(
        (session) =>
          session.classId === selectedClassId && session.courseId === desiredCourseId,
      ) ?? null;

    setActiveSession(matched);
  }, [selectedClassId, selectedCourseId]);

  useEffect(() => {
    if (!selectedClassId) return;
    void loadTodaySessions();
  }, [loadTodaySessions, selectedClassId]);

  const prepareSession = useCallback(async () => {
    if (!selectedClassId) {
      setScanError("Select a class before starting the scan session.");
      return;
    }

    setLoadingSession(true);
    setScanError("");
    setScannerError("");

    const res = await fetch("/api/attendance/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: selectedClassId,
        courseId: selectedCourseId === "general" ? null : selectedCourseId,
      }),
    });

    const json = (await res.json()) as { session?: AttendanceSession; error?: string };
    setLoadingSession(false);

    if (!res.ok || !json.session) {
      setScanError(json.error ?? "Unable to prepare today’s attendance session.");
      setActiveSession(null);
      return;
    }

    setActiveSession(json.session);
    setLatestResult(null);
    setScanError("");
  }, [selectedClassId, selectedCourseId]);

  /** Ignore re-reads of the exact same QR token within this window (ms). */
  const SAME_TOKEN_DEBOUNCE_MS = 5000;

  const processScan = useCallback(
    async (decodedText: string) => {
      if (!activeSession || submitting || confirmResult) return;

      const now = Date.now();
      if (
        decodedText === lastScanRef.current.token &&
        now - lastScanRef.current.at < SAME_TOKEN_DEBOUNCE_MS
      ) {
        return;
      }

      lastScanRef.current = { token: decodedText, at: now };
      setSubmitting(true);
      setScanError("");

      try {
        const res = await fetch("/api/attendance/qr-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: decodedText.trim(),
            sessionId: activeSession.id,
          }),
        });

        const json = (await res.json()) as
          | ({ error?: string } & Partial<ScanResult>)
          | ScanResult;

        if (!res.ok) {
          setScanError(("error" in json && json.error) || "Scan failed.");
          return;
        }

        const result = json as ScanResult;
        setLatestResult(result);
        setHistory((prev) => [{ ...result, timestamp: Date.now() }, ...prev.slice(0, 14)]);
        playFeedback(result.status);

        // ── Show confirmation popup so teacher must acknowledge before
        //    the next scan can be processed. Camera stays on. ──
        if (result.status === "checked_in" || result.status === "checked_out") {
          setConfirmResult(result);
        }
      } catch {
        setScanError("Network error while marking attendance.");
      } finally {
        setSubmitting(false);
      }
    },
    [activeSession, submitting, confirmResult],
  );

  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedCourse =
    selectedCourseId === "general"
      ? null
      : classCourses.find((course) => course.id === selectedCourseId) ?? null;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  if (role !== "teacher" && role !== "admin") {
    return null;
  }

  return (
    <div className="px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>

      <StitchSectionHeader
        eyebrow="QR Attendance"
        title="Instant Attendance Scanner"
        description="Open today’s session, point the camera at a student QR, and mark check-in or check-out immediately."
      />

      <div className="mt-8 grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className={stitchPanelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={selectedClassId}
                onValueChange={(value) => setSelectedClassId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class">
                    {selectedClass ? `${selectedClass.name} (${selectedClass.board})` : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {classes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.board})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedCourseId}
                onValueChange={(value) => setSelectedCourseId(value ?? "general")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose subject">
                    {selectedCourse ? `${selectedCourse.title} (${selectedCourse.subject})` : "General Attendance"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Attendance</SelectItem>
                  {classCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title} ({course.subject})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className={cn(stitchButtonClass, "gap-2")}
                onClick={() => void prepareSession()}
                disabled={loadingSession || !selectedClassId}
              >
                {loadingSession ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="h-4 w-4" />
                )}
                {activeSession ? "Refresh Session" : "Open Today’s Session"}
              </button>

              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "gap-2")}
                onClick={() => void loadTodaySessions()}
                disabled={!selectedClassId}
              >
                <RefreshCw className="h-4 w-4" />
                Reload Active Session
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-border/40 bg-muted/20 px-4 py-4">
              {activeSession ? (
                <div className="space-y-1.5 text-sm">
                  <p className="text-foreground">
                    Session: <span className="font-medium">{activeSession.subject}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Batch: {activeSession.className}
                    {activeSession.courseTitle ? ` • ${activeSession.courseTitle}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Date: {new Date(activeSession.sessionDate).toLocaleDateString("en-IN")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active session is ready yet. Open today’s session before scanning.
                </p>
              )}
            </div>

            {scanError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{scanError}</p>
              </div>
            )}
          </div>

          <div className={cn(stitchPanelClass, "overflow-hidden")}>
            <div
              className={cn(
                "relative mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-black/50",
                !scannerActive && "flex min-h-[280px] items-center justify-center",
              )}
            >
              {scannerActive ? (
                <QRScannerWidget
                  onScan={(text: string) => void processScan(text)}
                  onError={(message: string) => {
                    setScannerError(message);
                    setScannerActive(false);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <QrCode className="h-16 w-16 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {activeSession
                      ? "Camera is off. Start scanning when the student QR is ready."
                      : "Prepare today’s attendance session before turning the camera on."}
                  </p>
                </div>
              )}

              {scannerActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-56 w-56 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />
                </div>
              )}
            </div>

            {scannerError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{scannerError}</p>
              </div>
            )}

            <div className="mt-5">
              {!scannerActive ? (
                <button
                  type="button"
                  className={cn(stitchButtonClass, "w-full gap-2")}
                  disabled={!activeSession}
                  onClick={() => {
                    setScannerError("");
                    setScannerActive(true);
                  }}
                >
                  <Camera className="h-4 w-4" />
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  className={cn(stitchSecondaryButtonClass, "w-full gap-2")}
                  onClick={() => setScannerActive(false)}
                >
                  Stop Camera
                </button>
              )}
            </div>

            {submitting && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording attendance…
              </div>
            )}
          </div>

          {latestResult && (
            <div
              className={cn(
                stitchPanelClass,
                latestResult.status === "checked_in" && "border-primary/30 bg-primary/5",
                latestResult.status === "checked_out" && "border-blue-500/30 bg-blue-500/5",
                latestResult.status === "already_done" && "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-background/60">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-2xl text-foreground">{latestResult.studentName}</h3>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]",
                        latestResult.status === "checked_in" && "bg-primary/10 text-primary",
                        latestResult.status === "checked_out" && "bg-blue-500/10 text-blue-500",
                        latestResult.status === "already_done" && "bg-amber-500/10 text-amber-600",
                      )}
                    >
                      {latestResult.status === "checked_in" && "Checked In"}
                      {latestResult.status === "checked_out" && "Checked Out"}
                      {latestResult.status === "already_done" && "Already Done"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {latestResult.className} • {latestResult.subject}
                  </p>
                  <p className="mt-3 text-sm text-foreground">{latestResult.message}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-background/60 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-In</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatClock(latestResult.checkInAt)}
                  </p>
                </div>
                <div className="rounded-lg bg-background/60 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-Out</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatClock(latestResult.checkOutAt)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Confirmation Popup ── */}
          {confirmResult && (
            <Fragment>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={() => setConfirmResult(null)}
              />
              {/* Dialog */}
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className={cn(
                    "w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl",
                    confirmResult.status === "checked_in" && "border-primary/30",
                    confirmResult.status === "checked_out" && "border-blue-500/30",
                  )}
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-full",
                        confirmResult.status === "checked_in" && "bg-primary/10",
                        confirmResult.status === "checked_out" && "bg-blue-500/10",
                      )}
                    >
                      <CheckCircle2
                        className={cn(
                          "h-8 w-8",
                          confirmResult.status === "checked_in" && "text-primary",
                          confirmResult.status === "checked_out" && "text-blue-500",
                        )}
                      />
                    </div>

                    <h3 className="text-xl font-semibold text-foreground">
                      {confirmResult.studentName}
                    </h3>

                    <span
                      className={cn(
                        "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest",
                        confirmResult.status === "checked_in" && "bg-primary/10 text-primary",
                        confirmResult.status === "checked_out" && "bg-blue-500/10 text-blue-500",
                      )}
                    >
                      {confirmResult.status === "checked_in" ? "Checked In" : "Checked Out"}
                    </span>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {confirmResult.className} • {confirmResult.subject}
                    </p>

                    <div className="mt-2 grid w-full grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-In</p>
                        <p className="mt-0.5 text-base font-semibold text-foreground">
                          {formatClock(confirmResult.checkInAt)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-Out</p>
                        <p className="mt-0.5 text-base font-semibold text-foreground">
                          {formatClock(confirmResult.checkOutAt)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-1 text-sm text-foreground">{confirmResult.message}</p>

                    <button
                      type="button"
                      className={cn(stitchButtonClass, "mt-3 w-full gap-2")}
                      onClick={() => setConfirmResult(null)}
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </Fragment>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-1">
          <div className={stitchPanelClass}>
            <h3 className="text-3xl text-foreground">Today’s Session</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Only today’s active session accepts scans. Teachers are limited to their assigned class and subject.
            </p>
            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <p>Class: <span className="text-foreground">{activeSession?.className ?? "Not prepared"}</span></p>
              <p>Subject: <span className="text-foreground">{activeSession?.subject ?? "Not prepared"}</span></p>
              <p>Date: <span className="text-foreground">{activeSession ? new Date(activeSession.sessionDate).toLocaleDateString("en-IN") : "Not prepared"}</span></p>
            </div>
          </div>

          <div className={stitchPanelClass}>
            <h3 className="text-3xl text-foreground">Recent Scans</h3>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No scans yet. Open a session and start the camera to begin.
              </p>
            ) : (
              <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
                {history.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className={stitchPanelSoftClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{entry.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true,
                          })}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]",
                          entry.status === "checked_in" && "bg-primary/10 text-primary",
                          entry.status === "checked_out" && "bg-blue-500/10 text-blue-500",
                          entry.status === "already_done" && "bg-amber-500/10 text-amber-600",
                        )}
                      >
                        {entry.status === "checked_in" && "IN"}
                        {entry.status === "checked_out" && "OUT"}
                        {entry.status === "already_done" && "DONE"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{entry.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={stitchPanelClass}>
            <h3 className="text-3xl text-foreground">Scan Rules</h3>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>First scan marks check-in.</p>
              <p>Second scan marks check-out.</p>
              <p>Third scan is rejected as already done.</p>
              <p>Scans are debounced and session-limited for the current day only.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
