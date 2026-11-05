"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealVariant = "fade-up" | "fade" | "mask-up" | "soft-zoom";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
  variant?: RevealVariant;
  /** Accepted for existing call sites. Timing now comes from the motion tokens. */
  duration?: number;
}

/**
 * Reveals content once as it scrolls into view. The transition lives in CSS,
 * so content stays visible without script and with reduced motion on.
 */
export function Reveal({ children, className, delay = 0, threshold = 0.12, variant = "fade-up" }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.visible = "true";
            obs.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      data-reveal={variant === "fade" ? "fade" : "rise"}
      className={cn("stitch-reveal", className)}
      style={{ "--reveal-delay": `${Math.min(delay, 240)}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
