import { cn } from "@/lib/utils";

type LoadingAnimationProps = {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { bar: "w-1", step: 3 },
  md: { bar: "w-1.5", step: 5 },
  lg: { bar: "w-2", step: 7 },
};

/** Five rising steps lighting in turn. CSS only, so it stays smooth while the page is busy. */
export function LoadingAnimation({ className, label = "Loading", size = "md" }: LoadingAnimationProps) {
  const { bar, step } = sizes[size];

  return (
    <div className={cn("inline-flex items-end gap-1 text-accent", className)} role="status" aria-label={label}>
      {[1, 2, 3, 4, 5].map((level) => (
        <span
          key={level}
          aria-hidden="true"
          className={cn(bar, "rounded-[1px] bg-current motion-safe:animate-[step-load_1s_ease-in-out_infinite]")}
          style={{ height: level * step, animationDelay: `${(level - 1) * 110}ms` }}
        />
      ))}
    </div>
  );
}
