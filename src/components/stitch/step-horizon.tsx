import { cn } from "@/lib/utils";

/**
 * The STC scene at small scale: stairs in the page colour with the sun rising behind
 * them. It sits at the foot of every public page band, so each page joins the next
 * section without a hard edge.
 */
export function StepHorizon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 150"
      aria-hidden="true"
      className={cn("pointer-events-none absolute right-0 bottom-0 h-24 w-auto md:h-44", className)}
    >
      <circle className="sun-rise" cx="312" cy="54" r="44" fill="var(--accent)" />
      <path d="M0 150v-20h84v-24h84V82h84V58h84V34h84v116z" fill="var(--background)" />
    </svg>
  );
}

/** A tiny version for empty states and small moments inside the app. */
export function StepMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" className={cn("h-10 w-16", className)}>
      <circle cx="46" cy="13" r="9" fill="var(--accent)" />
      <path d="M4 38v-6h14v-6h14v-6h14v-6h14v24z" fill="var(--gold-200)" />
    </svg>
  );
}
