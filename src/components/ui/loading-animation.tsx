import { cn } from "@/lib/utils";

const LOTTIE_EMBED_URL =
  "https://lottie.host/embed/7ea519f0-84e5-4812-8f89-63dd8736bc45/4bSuxcButB.lottie";

type LoadingAnimationProps = {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

export function LoadingAnimation({
  className,
  label = "Loading",
  size = "md",
}: LoadingAnimationProps) {
  return (
    <div
      className={cn("inline-flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-label={label}
    >
      <iframe
        aria-hidden="true"
        className={cn("pointer-events-none border-0", sizeClasses[size])}
        src={LOTTIE_EMBED_URL}
        title=""
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
