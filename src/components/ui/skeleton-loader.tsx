import { cn } from "@/lib/utils";

/** Placeholder block. The shimmer uses transform only, so it runs off the main thread. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-linear-to-r before:from-transparent before:via-white/70 before:to-transparent",
        "motion-safe:before:animate-[skeleton-shimmer_1.4s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

type SkeletonVariant = "default" | "dashboard" | "admin" | "public" | "login";

/** Page-level skeletons mirror the real layout, so content lands without a jump. */
export function PageSkeleton({ variant = "default" }: { variant?: SkeletonVariant }) {
  return (
    <div role="status" aria-label="Loading page" className="w-full">
      {variant === "login" ? (
        <LoginSkeleton />
      ) : variant === "public" ? (
        <PublicSkeleton />
      ) : variant === "dashboard" || variant === "admin" ? (
        <WorkspaceSkeleton />
      ) : (
        <ListSkeleton />
      )}
    </div>
  );
}

function PageHeading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <PageHeading />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stitch-panel p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-4 h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <RowsPanel rows={5} />
        <RowsPanel rows={3} />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <PageHeading />
      <RowsPanel rows={7} />
    </div>
  );
}

function RowsPanel({ rows }: { rows: number }) {
  return (
    <div className="stitch-panel divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="ml-auto h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function PublicSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-4 py-16 md:px-8">
      <div className="space-y-4">
        <Skeleton className="h-14 w-full max-w-2xl" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stitch-panel p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
