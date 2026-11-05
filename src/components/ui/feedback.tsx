"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ── Toasts ─────────────────────────────────────────────── */

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function dismiss(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, message: string) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, tone, message }];
  emit();
  return id;
}

/** Call from anywhere on the client. Errors stay until dismissed; they carry information people need. */
export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: "text-success" },
  error: { icon: AlertTriangle, className: "text-destructive" },
  info: { icon: Info, className: "text-info" },
};

function ToastRow({ item }: { item: ToastItem }) {
  const { icon: Icon, className } = toneStyles[item.tone];
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (item.tone === "error" || paused) return;
    const timer = window.setTimeout(() => dismiss(item.id), 4000);
    return () => window.clearTimeout(timer);
  }, [item.id, item.tone, paused]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="toast-row pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-3 pr-2 text-sm text-foreground shadow-lg"
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", className)} />
      <p className="flex-1 leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss message"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function Toaster() {
  const items = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts,
    () => toasts,
  );

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[100] flex flex-col items-end gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      {items.map((item) => (
        <div key={item.id} className="w-full max-w-sm">
          <ToastRow item={item} />
        </div>
      ))}
    </div>
  );
}

/* ── Confirmation ───────────────────────────────────────── */

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, the action stays locked until this exact text is typed. */
  requireText?: string;
}

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

let openConfirm: ((pending: PendingConfirm) => void) | null = null;

/** Promise replacement for window.confirm: `if (!(await confirmAction({...}))) return;` */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!openConfirm) {
      resolve(false);
      return;
    }
    openConfirm({ ...options, resolve });
  });
}

function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    openConfirm = (next) => {
      setTyped("");
      setPending(next);
      setOpen(true);
    };
    return () => {
      openConfirm = null;
    };
  }, []);

  function settle(ok: boolean) {
    pending?.resolve(ok);
    setOpen(false);
  }

  const locked = Boolean(pending?.requireText) && typed !== pending?.requireText;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pending?.title}</DialogTitle>
          {pending?.description ? <DialogDescription>{pending.description}</DialogDescription> : null}
        </DialogHeader>
        {pending?.requireText ? (
          <label className="grid gap-2 text-sm">
            <span>
              Type <strong className="font-semibold">{pending.requireText}</strong> to continue.
            </span>
            <input
              ref={inputRef}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="stitch-input"
            />
          </label>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {pending?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={pending?.destructive ? "destructive-solid" : "default"} disabled={locked} onClick={() => settle(true)}>
            {pending?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mount once, near the root. */
export function FeedbackHost() {
  return (
    <>
      <Toaster />
      <ConfirmHost />
    </>
  );
}
