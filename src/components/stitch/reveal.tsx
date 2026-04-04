"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSmoothReveal } from "@/hooks/use-smooth-animation";

type RevealVariant = "fade-up" | "fade" | "mask-up" | "soft-zoom";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
  variant?: RevealVariant;
  /** Override animation duration in ms (default: 900) */
  duration?: number;
}

/**
 * Scroll-triggered reveal component powered by Web Animations API.
 *
 * WAAPI runs animations on the compositor thread, guaranteeing
 * buttery 60-120fps regardless of main-thread load.
 *
 * - "fade-up"   — opacity + translateY (default)
 * - "fade"      — opacity only
 * - "mask-up"   — opacity + large translateY + blur
 * - "soft-zoom" — opacity + scale + blur
 */
export function Reveal({
  children,
  className,
  delay = 0,
  threshold = 0.15,
  variant = "fade-up",
  duration = 900,
}: RevealProps) {
  const ref = useSmoothReveal(variant, delay, threshold, duration);

  return (
    <div
      ref={ref}
      data-reveal={variant}
      className={cn("stitch-reveal", className)}
      style={
        {
          // Start hidden (WAAPI will animate from here)
          opacity: 0,
          // GPU-promote so compositor handles the layer
          contain: "layout style",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
