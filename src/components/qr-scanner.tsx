"use client";

import { useEffect, useRef, useState } from "react";

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

const CONTAINER_ID = "html5-qr-reader";
const SCAN_BOX_SIZE = 220;
const SCAN_DEBOUNCE_MS = 1500;
const START_DELAY_MS = 180;
const START_TIMEOUT_MS = 3000;
const IDLE_RESTART_MS = 15000;
const INACTIVE_CAMERA_MS = 5000;
const LOW_END_SCAN_BOX_SIZE = 180;

let activeScannerOwner: symbol | null = null;

type Html5QrcodeModule = typeof import("html5-qrcode");
type Html5QrcodeInstance = InstanceType<Html5QrcodeModule["Html5Qrcode"]>;

interface ScannerTuning {
  fps: number;
  qrbox: number;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const ownerRef = useRef(Symbol("qr-scanner-owner"));
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const isRunningRef = useRef(false);
  const isStartingRef = useRef(false);
  const startAttemptRef = useRef(0);
  const initLockRef = useRef(false);
  const cleanupPromiseRef = useRef<Promise<void> | null>(null);
  const lastScanAtRef = useRef(0);
  const lastActivityAtRef = useRef(0);
  const wasRunningBeforeHideRef = useRef(false);
  const recoveryIntervalRef = useRef<number | null>(null);
  const restartInFlightRef = useRef(false);
  const startFailureCountRef = useRef(0);
  const restartScannerRef = useRef<(() => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartNonce, setRestartNonce] = useState(0);

  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let mounted = true;

    const logCriticalError = (label: string, detail: unknown) => {
      console.error(`[QR Scanner] ${label}`, detail);
    };

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const getScannerTuning = (): ScannerTuning =>
      startFailureCountRef.current >= 2
        ? { fps: 8, qrbox: LOW_END_SCAN_BOX_SIZE }
        : { fps: 10, qrbox: SCAN_BOX_SIZE };

    const clearContainer = () => {
      const container = document.getElementById(CONTAINER_ID);
      if (container) {
        container.innerHTML = "";
      }
    };

    const applyVideoAttributes = () => {
      const video = document
        .getElementById(CONTAINER_ID)
        ?.querySelector("video");

      if (!video) {
        return;
      }

      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      (video as HTMLVideoElement).playsInline = true;
    };

    const stopScanner = async () => {
      const scanner = scannerRef.current;

      if (!scanner) {
        clearContainer();
        if (activeScannerOwner === ownerRef.current) {
          activeScannerOwner = null;
        }
        return;
      }

      try {
        const state = scanner.getState();
        if (isRunningRef.current || state === 2 || state === 3) {
          isRunningRef.current = false;
          await scanner.stop();
        }
      } catch (stopError) {
        logCriticalError("stop failed", stopError);
      }

      try {
        await Promise.resolve(scanner.clear());
      } catch (clearError) {
        // html5-qrcode can throw here if React already removed the container.
        logCriticalError("clear failed", clearError);
      }

      scannerRef.current = null;
      isStartingRef.current = false;
      lastActivityAtRef.current = 0;
      clearContainer();

      if (activeScannerOwner === ownerRef.current) {
        activeScannerOwner = null;
      }
    };

    const restartScanner = async () => {
      if (restartInFlightRef.current || !mounted) {
        return;
      }

      restartInFlightRef.current = true;

      try {
        await stopScanner();

        if (!mounted) {
          return;
        }

        setError(null);
        setRestartNonce((value) => value + 1);
      } finally {
        restartInFlightRef.current = false;
      }
    };

    restartScannerRef.current = restartScanner;

    const getPreferredCamera = async (module: Html5QrcodeModule) => {
      const cameras = await module.Html5Qrcode.getCameras();
      if (!cameras.length) {
        throw new Error("No camera was found on this device.");
      }

      const rearCamera =
        cameras.find((camera) =>
          /back|rear|environment|wide/i.test(camera.label),
        ) ?? cameras[cameras.length - 1];

      return rearCamera.id;
    };

    const startScanner = async (
      module: Html5QrcodeModule,
      scanner: Html5QrcodeInstance,
      attempt = 0,
    ) => {
      if (isStartingRef.current || isRunningRef.current || !mounted) {
        return;
      }

      try {
        const state = scanner.getState();
        if (state !== module.Html5QrcodeScannerState.NOT_STARTED) {
          return;
        }
      } catch (stateError) {
        logCriticalError("state check failed", stateError);
        return;
      }

      isStartingRef.current = true;
      startAttemptRef.current += 1;
      const attemptId = startAttemptRef.current;

      try {
        const cameraId = await getPreferredCamera(module);
        const tuning = getScannerTuning();
        await sleep(START_DELAY_MS);

        if (!mounted || scannerRef.current !== scanner) {
          return;
        }

        const startPromise = scanner.start(
          { deviceId: { exact: cameraId } },
          {
            fps: tuning.fps,
            qrbox: { width: tuning.qrbox, height: tuning.qrbox },
            aspectRatio: 1,
            disableFlip: true,
            videoConstraints: {
              deviceId: { exact: cameraId },
              facingMode: "environment",
              width: { ideal: 320 },
              height: { ideal: 320 },
            },
          },
          (decodedText: string) => {
            if (!isRunningRef.current || scannerRef.current !== scanner) {
              return;
            }

            const now = Date.now();
            if (now - lastScanAtRef.current < SCAN_DEBOUNCE_MS) {
              return;
            }

            lastScanAtRef.current = now;
            lastActivityAtRef.current = now;
            navigator.vibrate?.(50);
            onScanRef.current(decodedText);
          },
          () => {
            // Ignore per-frame decode misses to keep the UI quiet.
          },
        );

        const timedStart = await Promise.race([
          startPromise.then(() => "started" as const),
          sleep(START_TIMEOUT_MS).then(() => "timeout" as const),
        ]);

        if (timedStart === "timeout") {
          throw new Error("Camera start timeout");
        }

        applyVideoAttributes();
        isRunningRef.current = true;
        lastActivityAtRef.current = Date.now();
        startFailureCountRef.current = 0;
        setError(null);
      } catch (startError) {
        startFailureCountRef.current += 1;

        if (attempt === 0 && mounted && scannerRef.current === scanner) {
          await stopScanner();

          if (!mounted || !document.getElementById(CONTAINER_ID)) {
            return;
          }

          clearContainer();
          const retryScanner = new module.Html5Qrcode(CONTAINER_ID, {
            verbose: false,
            formatsToSupport: [module.Html5QrcodeSupportedFormats.QR_CODE],
          });
          scannerRef.current = retryScanner;
          await startScanner(module, retryScanner, 1);
          return;
        }

        throw startError;
      } finally {
        if (attemptId === startAttemptRef.current) {
          isStartingRef.current = false;
        }
      }
    };

    const init = async () => {
      if (cleanupPromiseRef.current) {
        await cleanupPromiseRef.current;
        cleanupPromiseRef.current = null;
      }

      if (initLockRef.current || scannerRef.current || !mounted) {
        return;
      }

      if (activeScannerOwner && activeScannerOwner !== ownerRef.current) {
        const userMsg = "Another scanner is already active. Close it and try again.";
        setError(userMsg);
        onErrorRef.current?.(userMsg);
        return;
      }

      initLockRef.current = true;
      activeScannerOwner = ownerRef.current;
      setError(null);

      try {
        const {
          Html5Qrcode,
          Html5QrcodeSupportedFormats,
          Html5QrcodeScannerState,
        }: Html5QrcodeModule = await import("html5-qrcode");

        if (!mounted || !document.getElementById(CONTAINER_ID)) {
          await stopScanner();
          return;
        }

        clearContainer();

        const scanner = new Html5Qrcode(CONTAINER_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = scanner;
        await startScanner(
          {
            Html5Qrcode,
            Html5QrcodeSupportedFormats,
            Html5QrcodeScannerState,
          } as Html5QrcodeModule,
          scanner,
        );

        if (!mounted) {
          await stopScanner();
          return;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logCriticalError("init failed", msg);

        let userMsg = `Camera error: ${msg}`;

        if (
          msg.includes("Permission") ||
          msg.includes("NotAllowed") ||
          msg.includes("denied")
        ) {
          userMsg =
            "Camera access denied. Allow camera permission in your browser settings and try again.";
        } else if (
          msg.includes("NotFound") ||
          msg.includes("DevicesNotFound")
        ) {
          userMsg = "No camera was found on this device.";
        } else if (
          msg.includes("NotReadable") ||
          msg.includes("Could not start") ||
          msg.includes("track")
        ) {
          userMsg =
            "The camera could not start. Close other apps using the camera and try again.";
        } else if (
          msg.includes("insecure") ||
          msg.includes("https")
        ) {
          userMsg = "Camera access requires HTTPS.";
        } else if (
          msg.includes("new state") ||
          msg.includes("transition")
        ) {
          userMsg =
            "The camera session got out of sync. Please close and reopen the scanner.";
        }

        if (mounted) {
          setError(userMsg);
          onErrorRef.current?.(userMsg);
        }

        await stopScanner();
      } finally {
        initLockRef.current = false;
      }
    };

    const handleVisibilityChange = async () => {
      if (!mounted) {
        return;
      }

      if (document.visibilityState === "hidden") {
        wasRunningBeforeHideRef.current = isRunningRef.current;
        await stopScanner();
        return;
      }

      if (document.visibilityState === "visible") {
        const idleDuration =
          lastActivityAtRef.current > 0
            ? Date.now() - lastActivityAtRef.current
            : Number.POSITIVE_INFINITY;

        if (wasRunningBeforeHideRef.current || idleDuration >= INACTIVE_CAMERA_MS) {
          void restartScanner();
          return;
        }

        void init();
      }
    };

    void init();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    recoveryIntervalRef.current = window.setInterval(() => {
      if (!mounted || document.visibilityState !== "visible") {
        return;
      }

      if (!isRunningRef.current || isStartingRef.current || restartInFlightRef.current) {
        return;
      }

      const now = Date.now();
      const inactiveDuration =
        lastActivityAtRef.current > 0 ? now - lastActivityAtRef.current : 0;
      const noScanDuration =
        lastScanAtRef.current > 0 ? now - lastScanAtRef.current : 0;

      if (
        inactiveDuration >= INACTIVE_CAMERA_MS ||
        noScanDuration >= IDLE_RESTART_MS
      ) {
        void restartScanner();
      }
    }, 3000);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      restartScannerRef.current = null;
      if (recoveryIntervalRef.current !== null) {
        window.clearInterval(recoveryIntervalRef.current);
        recoveryIntervalRef.current = null;
      }
      cleanupPromiseRef.current = stopScanner();
    };
  }, [restartNonce]);

  if (error) {
    return (
      <div className="flex min-h-[250px] items-center justify-center rounded-xl bg-black/30 p-6">
        <p className="text-center text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        id={CONTAINER_ID}
        className="w-full overflow-hidden rounded-xl"
        style={{ minHeight: 250 }}
      />
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          onClick={() => {
            void (restartScannerRef.current?.() ??
              Promise.resolve().then(() => {
                setRestartNonce((value) => value + 1);
              }));
          }}
        >
          Restart Scanner
        </button>
      </div>
    </div>
  );
}
