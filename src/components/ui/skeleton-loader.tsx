"use client";

import { LoadingAnimation } from "@/components/ui/loading-animation";
import { cn } from "@/lib/utils";

/**
 * Shimmer-animated skeleton block used as a placeholder while content loads.
 * Accepts `className` for custom sizing / rounding.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        "before:animate-[skeleton-shimmer_1.8s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

/* ──────────────────────────────────────────────────────────
   Pre-composed skeleton layouts used by loading.tsx files
   ────────────────────────────────────────────────────────── */

/** Full-page skeleton loader — STC branded with animated logo + content blocks */
export function PageSkeleton({ variant = "default" }: { variant?: "default" | "dashboard" | "admin" | "public" | "login" }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <LoadingAnimation className="mb-8" size="lg" />

      {/* Variant-specific skeleton content */}
      {variant === "dashboard" ? <DashboardSkeletonContent /> : null}
      {variant === "admin" ? <AdminSkeletonContent /> : null}
      {variant === "public" ? <PublicSkeletonContent /> : null}
      {variant === "login" ? <LoginSkeletonContent /> : null}
      {variant === "default" ? <DefaultSkeletonContent /> : null}
    </div>
  );
}

function DefaultSkeletonContent() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Title */}
      <div className="mx-auto space-y-3">
        <Skeleton className="mx-auto h-3 w-24 rounded-full" />
        <Skeleton className="mx-auto h-8 w-64 rounded-2xl" />
        <Skeleton className="mx-auto h-4 w-80 rounded-full" />
      </div>
      {/* Content cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[24px] border border-black/6 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(26,28,29,0.08)]"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="mt-4 h-8 w-20 rounded-xl" />
            <Skeleton className="mt-3 h-3 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeletonContent() {
  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-10 w-56 rounded-2xl" />
        <Skeleton className="h-4 w-80 rounded-full" />
      </div>
      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[24px] border border-black/6 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(26,28,29,0.08)]"
          >
            <Skeleton className="h-2.5 w-20 rounded-full" />
            <Skeleton className="mt-5 h-10 w-16 rounded-xl" />
            <Skeleton className="mt-3 h-3 w-full rounded-full" />
          </div>
        ))}
      </div>
      {/* Content panels */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(26,28,29,0.08)]">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="mt-5 h-8 w-64 rounded-2xl" />
          <Skeleton className="mt-4 h-3 w-full rounded-full" />
          <Skeleton className="mt-2 h-3 w-3/4 rounded-full" />
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
        <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(26,28,29,0.08)]">
          <Skeleton className="h-3 w-20 rounded-full" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[20px] border border-black/5 bg-surface-container-low p-4">
                <Skeleton className="h-4 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminSkeletonContent() {
  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <Skeleton className="h-7 w-52 rounded-2xl" />
          <Skeleton className="h-3 w-72 rounded-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[20px] border border-black/5 bg-white/78 p-6 shadow-[0_18px_40px_-28px_rgba(26,28,29,0.12)] backdrop-blur-xl"
          >
            <Skeleton className="h-2.5 w-16 rounded-full" />
            <Skeleton className="mt-5 h-10 w-14 rounded-xl" />
            <Skeleton className="mt-2 h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(26,28,29,0.08)]">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-8 w-52 rounded-2xl" />
            <Skeleton className="mt-2 h-3 w-64 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="ml-auto h-4 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PublicSkeletonContent() {
  return (
    <div className="w-full max-w-4xl space-y-8">
      {/* Hero skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-12 w-96 max-w-full rounded-2xl" />
        <Skeleton className="h-12 w-72 max-w-full rounded-2xl" />
        <Skeleton className="mt-4 h-5 w-full max-w-lg rounded-full" />
        <Skeleton className="h-5 w-3/4 max-w-md rounded-full" />
        <div className="mt-6 flex gap-4">
          <Skeleton className="h-12 w-40 rounded-xl" />
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>
      </div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 text-center">
            <Skeleton className="mx-auto h-10 w-20 rounded-xl" />
            <Skeleton className="mx-auto h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>
      {/* Sections */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[24px] border border-black/6 bg-white p-8 shadow-[0_24px_60px_-28px_rgba(26,28,29,0.08)]"
          >
            <Skeleton className="h-14 w-14 rounded-xl" />
            <Skeleton className="mt-6 h-8 w-32 rounded-2xl" />
            <Skeleton className="mt-4 h-3 w-full rounded-full" />
            <Skeleton className="mt-2 h-3 w-4/5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginSkeletonContent() {
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Logo */}
      <div className="text-center">
        <Skeleton className="mx-auto h-10 w-40 rounded-2xl" />
        <Skeleton className="mx-auto mt-3 h-3 w-32 rounded-full" />
      </div>
      {/* Card */}
      <div className="rounded-[28px] border border-black/6 bg-white p-7 shadow-[0_20px_90px_rgba(26,28,29,0.06)]">
        {/* Tabs */}
        <div className="flex gap-6 border-b border-black/6 pb-4">
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        {/* Form fields */}
        <div className="mt-7 space-y-4">
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        {/* Divider */}
        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-3 w-6 rounded-full" />
          <Skeleton className="h-px flex-1" />
        </div>
        {/* Google button */}
        <Skeleton className="mt-6 h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
