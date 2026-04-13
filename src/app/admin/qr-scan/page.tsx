"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  AlertTriangle,
  QrCode,
  X,
  Clock,
  ShieldAlert,
  Zap,
  User,
} from "lucide-react";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LookupResult {
  action: "check-in" | "check-out" | "already-completed" | "too-early";
  studentId: string;
  studentName: string;
  studentPhoto: string | null;
  className: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  remainingMinutes?: number;
  minDuration?: number;
  existingManual?: boolean;
  message: string;
}

interface ScanHistoryEntry {
  action: "check-in" | "check-out" | "already-completed" | "too-early" | "error";
  studentName: string;
  message: string;
  timestamp: number;
  checkInAt?: string;
  checkOutAt?: string;
}

/* ------------------------------------------------------------------ */
/*  Feedback helpers                                                   */
/* ------------------------------------------------------------------ */

function playSound(type: "success-in" | "success-out" | "error" | "warning") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;

    switch (type) {
      case "success-in":
        osc.frequency.value = 880;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        break;
      case "success-out":
        osc.frequency.value = 660;
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          gain2.gain.value = 0.15;
          osc2.frequency.value = 880;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.15);
        }, 120);
        break;
      case "warning":
        osc.frequency.value = 440;
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        break;
      case "error":
        osc.frequency.value = 330;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        break;
    }
  } catch {
    // Audio not supported
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    // Vibration not supported
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function QrScanPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner-container";

  // Debounce
  const lastScannedTokenRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Two-phase state
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState("");

  // Scan history
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);

  // Quick mode toggle
  const [quickMode, setQuickMode] = useState(false);

  // Redirect students
  useEffect(() => {
    if (!authLoading && role === "student") {
      router.push("/dashboard");
    }
  }, [role, authLoading, router]);

  /* ---- Confirm action ---- */
  const confirmAction = useCallback(
    async (result: LookupResult) => {
      setConfirmLoading(true);
      setError("");

      try {
        const res = await fetch("/api/attendance/qr-scan/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: result.studentId,
            action: result.action,
          }),
        });

        const data = (await res.json()) as {
          action?: string;
          studentName?: string;
          studentPhoto?: string | null;
          checkInAt?: string;
          checkOutAt?: string;
          message?: string;
          error?: string;
        };

        if (!res.ok) {
          setError(data.error ?? "Confirmation failed");
          playSound("error");
          vibrate(300);
          return;
        }

        const confirmedAction = data.action as ScanHistoryEntry["action"];

        // Add to history
        setScanHistory((prev) => [
          {
            action: confirmedAction,
            studentName: data.studentName ?? result.studentName,
            message: data.message ?? "",
            timestamp: Date.now(),
            checkInAt: data.checkInAt,
            checkOutAt: data.checkOutAt,
          },
          ...prev.slice(0, 19),
        ]);

        // Feedback
        if (confirmedAction === "check-in") {
          playSound("success-in");
          vibrate(100);
        } else if (confirmedAction === "check-out") {
          playSound("success-out");
          vibrate([100, 50, 100]);
        }

        // Clear the confirmation card
        setLookupResult(null);
      } catch {
        setError("Network error — check your connection");
        playSound("error");
        vibrate(300);
      } finally {
        setConfirmLoading(false);
      }
    },
    [],
  );

  /* ---- Process QR code ---- */
  const processQrCode = useCallback(
    async (decodedText: string) => {
      // Block scans while confirmation dialog is open (unless quick mode)
      if (lookupResult && !quickMode) return;

      // Debounce: ignore same token within 5 seconds
      const now = Date.now();
      if (
        decodedText === lastScannedTokenRef.current &&
        now - lastScanTimeRef.current < 5000
      ) {
        return;
      }
      lastScannedTokenRef.current = decodedText;
      lastScanTimeRef.current = now;

      // Extract token from URL or raw text
      let token = decodedText.trim();
      try {
        const url = new URL(decodedText);
        const paramToken = url.searchParams.get("t");
        if (paramToken) token = paramToken;
      } catch {
        // Not a URL — use raw text as token
      }

      if (!token) return;

      setLookupLoading(true);
      setError("");
      setLookupResult(null);

      try {
        const res = await fetch("/api/attendance/qr-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = (await res.json()) as LookupResult & { error?: string };

        if (!res.ok) {
          setError(data.error ?? "Scan failed");
          playSound("error");
          vibrate(300);

          // Log error to history
          setScanHistory((prev) => [
            {
              action: "error",
              studentName: "—",
              message: data.error ?? "Scan failed",
              timestamp: Date.now(),
            },
            ...prev.slice(0, 19),
          ]);
          return;
        }

        // Handle non-actionable results
        if (data.action === "already-completed") {
          setLookupResult(data);
          playSound("warning");
          vibrate(200);

          setScanHistory((prev) => [
            {
              action: "already-completed",
              studentName: data.studentName,
              message: data.message,
              timestamp: Date.now(),
              checkInAt: data.checkInAt ?? undefined,
              checkOutAt: data.checkOutAt ?? undefined,
            },
            ...prev.slice(0, 19),
          ]);
          return;
        }

        if (data.action === "too-early") {
          setLookupResult(data);
          playSound("warning");
          vibrate([100, 100, 100]);

          setScanHistory((prev) => [
            {
              action: "too-early",
              studentName: data.studentName,
              message: data.message,
              timestamp: Date.now(),
              checkInAt: data.checkInAt ?? undefined,
            },
            ...prev.slice(0, 19),
          ]);
          return;
        }

        // Actionable: check-in or check-out
        if (quickMode) {
          // Skip confirmation — auto-confirm
          await confirmAction(data);
        } else {
          // Show confirmation card
          setLookupResult(data);
          playSound("success-in");
          vibrate(50);
        }
      } catch {
        setError("Network error — check your connection");
        playSound("error");
        vibrate(300);
      } finally {
        setLookupLoading(false);
      }
    },
    [lookupResult, quickMode, confirmAction],
  );

  /* ---- Scanner controls ---- */
  const startScanner = useCallback(async () => {
    setCameraError("");
    setError("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Safely clean up any existing scanner instance
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
            await scannerRef.current.stop();
          }
        } catch {
          // Already stopped — ignore
        }
        try {
          scannerRef.current.clear();
        } catch {
          // Container already cleared — ignore
        }
        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      // Responsive qrbox: 70% of container, capped between 150–250px
      const qrboxFunction = (vw: number, vh: number) => {
        const size = Math.min(Math.floor(Math.min(vw, vh) * 0.7), 250);
        return { width: Math.max(size, 150), height: Math.max(size, 150) };
      };

      const scannerConfig = {
        fps: 5,
        qrbox: qrboxFunction,
        disableFlip: false,
      };

      const onSuccess = (decodedText: string) => {
        void processQrCode(decodedText);
      };
      const onFailure = () => {
        /* No QR in frame — expected */
      };

      // ── Camera constraints ──
      // Cap resolution at 640×480. That is MORE than enough for QR
      // recognition and prevents the library from requesting the phone's
      // full 12-48 MP sensor, which causes an OOM tab crash on mobile.
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: "environment" },
        width: { min: 320, ideal: 640, max: 1280 },
        height: { min: 240, ideal: 480, max: 720 },
      };

      // Attempt 1 — constrained camera
      try {
        await scanner.start(videoConstraints, scannerConfig, onSuccess, onFailure);
      } catch {
        // Attempt 2 — enumerate cameras and pick the back one by ID
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length === 0) {
            setCameraError("No camera found on this device.");
            return;
          }
          const backCam = cameras.find(
            (c) =>
              c.label.toLowerCase().includes("back") ||
              c.label.toLowerCase().includes("rear") ||
              c.label.toLowerCase().includes("environment"),
          );
          const cameraId = backCam?.id ?? cameras[cameras.length - 1].id;
          await scanner.start(cameraId, scannerConfig, onSuccess, onFailure);
        } catch (fallbackErr) {
          const msg2 = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          if (msg2.includes("Permission") || msg2.includes("NotAllowed")) {
            setCameraError(
              "Camera access denied. Please allow camera permission and try again.",
            );
          } else {
            setCameraError(`Camera error: ${msg2}`);
          }
          return;
        }
      }

      setScanning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setCameraError(
          "Camera access denied. Please allow camera permission and try again.",
        );
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(`Camera error: ${msg}`);
      }
    }
  }, [processQrCode]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
          await scannerRef.current.stop();
        }
      } catch {
        // Already stopped
      }
      try {
        scannerRef.current.clear();
      } catch {
        // Already cleared
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === 2 || state === 3) {
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                try {
                  scanner.clear();
                } catch {
                  // ignore
                }
              });
          } else {
            try {
              scanner.clear();
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
    };
  }, []);

  /* ---- Helpers ---- */
  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  };

  const dismissLookup = () => {
    setLookupResult(null);
    setError("");
  };

  /* ---- Auth guard ---- */
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== "teacher" && role !== "admin") {
    return null;
  }

  /* ---- Render ---- */
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
        title="Scan Student QR"
        description="Point the camera at a student's QR code. Verify student details, then confirm attendance."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Scanner column */}
        <div className="space-y-6">
          {/* Scanner viewport */}
          <div className={cn(stitchPanelClass, "overflow-hidden")}>
            <div
              id={scannerContainerId}
              className={cn(
                "relative mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-black/50 [&_video]:!max-h-[60vh] [&_video]:!object-cover",
                !scanning &&
                  "flex min-h-[280px] items-center justify-center",
              )}
            >
              {!scanning && (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <QrCode className="h-16 w-16 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Camera is off. Tap the button below to start scanning.
                  </p>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{cameraError}</p>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              {!scanning ? (
                <button
                  type="button"
                  className={cn(stitchButtonClass, "w-full gap-2")}
                  onClick={() => void startScanner()}
                >
                  <Camera className="h-4 w-4" />
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  className={cn(stitchSecondaryButtonClass, "w-full gap-2")}
                  onClick={() => void stopScanner()}
                >
                  Stop Camera
                </button>
              )}
            </div>

            {/* Quick mode toggle */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Zap className={cn("h-4 w-4", quickMode ? "text-amber-500" : "text-muted-foreground")} />
                <div>
                  <p className="text-sm font-medium text-foreground">Quick Mode</p>
                  <p className="text-xs text-muted-foreground">Skip confirmation step</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={quickMode}
                onClick={() => setQuickMode(!quickMode)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  quickMode ? "bg-amber-500" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform",
                    quickMode ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>

            {lookupLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up student…
              </div>
            )}
          </div>

          {/* ---- Confirmation card ---- */}
          {lookupResult && (
            <div
              className={cn(
                stitchPanelClass,
                "border-2 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200",
                lookupResult.action === "check-in" &&
                  "border-primary/40 bg-primary/5",
                lookupResult.action === "check-out" &&
                  "border-blue-500/40 bg-blue-500/5",
                lookupResult.action === "already-completed" &&
                  "border-yellow-500/40 bg-yellow-500/5",
                lookupResult.action === "too-early" &&
                  "border-orange-500/40 bg-orange-500/5",
              )}
            >
              {/* Dismiss button */}
              <button
                type="button"
                onClick={dismissLookup}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Student info */}
              <div className="flex items-start gap-4">
                {/* Avatar */}
                {lookupResult.studentPhoto ? (
                  <img
                    src={lookupResult.studentPhoto}
                    alt={lookupResult.studentName}
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border/50"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted/50 ring-2 ring-border/50">
                    <User className="h-7 w-7 text-muted-foreground/60" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-2xl font-semibold text-foreground">
                    {lookupResult.studentName}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lookupResult.className}
                  </p>

                  {/* Status badge */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {lookupResult.action === "check-in" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                        <LogIn className="h-3 w-3" />
                        Ready for Check-In
                      </span>
                    )}
                    {lookupResult.action === "check-out" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-500">
                        <LogOut className="h-3 w-3" />
                        Ready for Check-Out
                      </span>
                    )}
                    {lookupResult.action === "already-completed" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Already Completed
                      </span>
                    )}
                    {lookupResult.action === "too-early" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-600">
                        <Clock className="h-3 w-3" />
                        Too Early
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Times */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-background/60 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Check-In
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatTime(lookupResult.checkInAt)}
                  </p>
                </div>
                <div className="rounded-lg bg-background/60 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Check-Out
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatTime(lookupResult.checkOutAt)}
                  </p>
                </div>
              </div>

              {/* Too-early detail */}
              {lookupResult.action === "too-early" &&
                lookupResult.remainingMinutes != null && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      Minimum session duration is{" "}
                      {lookupResult.minDuration ?? 30} minutes.{" "}
                      <strong>
                        {lookupResult.remainingMinutes} minute
                        {lookupResult.remainingMinutes !== 1 ? "s" : ""}{" "}
                        remaining.
                      </strong>
                    </p>
                  </div>
                )}

              {/* Already-completed detail */}
              {lookupResult.action === "already-completed" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    {lookupResult.studentName} has already completed attendance
                    for today. No further scans allowed.
                  </p>
                </div>
              )}

              {/* Message */}
              <p className="mt-4 text-sm text-muted-foreground">
                {lookupResult.message}
              </p>

              {/* Action buttons */}
              {(lookupResult.action === "check-in" ||
                lookupResult.action === "check-out") && (
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5",
                      lookupResult.action === "check-in"
                        ? "bg-primary text-primary-foreground hover:brightness-105"
                        : "bg-blue-600 text-white hover:brightness-105",
                    )}
                    onClick={() => void confirmAction(lookupResult)}
                    disabled={confirmLoading}
                  >
                    {confirmLoading ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : lookupResult.action === "check-in" ? (
                      <span className="inline-flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Confirm Check-In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Confirm Check-Out
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      stitchSecondaryButtonClass,
                      "gap-2",
                    )}
                    onClick={dismissLookup}
                    disabled={confirmLoading}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              )}

              {/* Dismiss for non-actionable */}
              {(lookupResult.action === "already-completed" ||
                lookupResult.action === "too-early") && (
                <div className="mt-6">
                  <button
                    type="button"
                    className={cn(stitchSecondaryButtonClass, "w-full gap-2")}
                    onClick={dismissLookup}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---- Error banner ---- */}
          {error && !lookupResult && (
            <div
              className={cn(
                stitchPanelSoftClass,
                "flex items-start gap-3 border-destructive/30 bg-destructive/5",
              )}
            >
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Scan Error</p>
                <p className="mt-1 text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* ---- Recent scans sidebar ---- */}
        <div className={cn(stitchPanelClass, "xl:block hidden")}>
          <h3 className="text-3xl text-foreground">Recent Scans</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {scanHistory.length === 0
              ? "No scans yet. Start the camera and scan a student QR code."
              : `${scanHistory.length} scan${scanHistory.length > 1 ? "s" : ""} this session`}
          </p>

          {scanHistory.length > 0 && (
            <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto">
              {scanHistory.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className={cn(
                    stitchPanelSoftClass,
                    "flex items-center justify-between gap-3",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {entry.studentName}
                    </p>
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
                      entry.action === "check-in" &&
                        "bg-primary/10 text-primary",
                      entry.action === "check-out" &&
                        "bg-blue-500/10 text-blue-500",
                      entry.action === "already-completed" &&
                        "bg-yellow-500/10 text-yellow-500",
                      entry.action === "too-early" &&
                        "bg-orange-500/10 text-orange-500",
                      entry.action === "error" &&
                        "bg-destructive/10 text-destructive",
                    )}
                  >
                    {entry.action === "check-in" && "IN"}
                    {entry.action === "check-out" && "OUT"}
                    {entry.action === "already-completed" && "DONE"}
                    {entry.action === "too-early" && "EARLY"}
                    {entry.action === "error" && "ERR"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile recent scans (below scanner) */}
        <div className={cn(stitchPanelClass, "xl:hidden")}>
          <h3 className="text-2xl text-foreground">Recent Scans</h3>
          {scanHistory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No scans yet.
            </p>
          ) : (
            <div className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto">
              {scanHistory.slice(0, 10).map((entry, i) => (
                <div
                  key={`m-${entry.timestamp}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {entry.studentName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider",
                      entry.action === "check-in" &&
                        "bg-primary/10 text-primary",
                      entry.action === "check-out" &&
                        "bg-blue-500/10 text-blue-500",
                      entry.action === "already-completed" &&
                        "bg-yellow-500/10 text-yellow-500",
                      entry.action === "too-early" &&
                        "bg-orange-500/10 text-orange-500",
                      entry.action === "error" &&
                        "bg-destructive/10 text-destructive",
                    )}
                  >
                    {entry.action === "check-in" && "IN"}
                    {entry.action === "check-out" && "OUT"}
                    {entry.action === "already-completed" && "DONE"}
                    {entry.action === "too-early" && "EARLY"}
                    {entry.action === "error" && "ERR"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
