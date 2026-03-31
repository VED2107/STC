"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

type RevealVariant = "fade-up" | "fade" | "mask-up" | "soft-zoom";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
  variant?: RevealVariant;
}

export function Reveal({
  children,
  className,
  delay = 0,
  threshold = 0.2,
  variant = "fade-up",
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Use a callback ref pattern to apply visibility via DOM mutation
  // instead of useState (avoids React re-render per element).
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[], obs: IntersectionObserver) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        (entry.target as HTMLElement).dataset.visible = "true";
        obs.unobserve(entry.target);
      }
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.visible = "true";
      return;
    }

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "0px 0px -12% 0px",
      threshold,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, handleIntersection]);

  return (
    <div
      ref={ref}
      data-reveal={variant}
      data-visible="false"
      className={cn("stitch-reveal", className)}
      style={
        {
          "--reveal-delay": `${delay}ms`,
          // GPU-promote this element so transitions use compositor thread
          willChange: "transform, opacity",
          contain: "layout style",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
