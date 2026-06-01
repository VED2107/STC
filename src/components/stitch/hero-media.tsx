"use client";

import Image from "next/image";
import { useParallax } from "@/hooks/use-smooth-animation";

/**
 * Hero background image with buttery-smooth parallax scrolling.
 * Uses requestAnimationFrame + compositor-only transforms → 60-120fps.
 */
export function HeroMedia() {
  const parallaxRef = useParallax(0.08, 48);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={parallaxRef}
        className="absolute inset-0"
        style={{
          transformOrigin: "center center",
          contain: "layout style paint",
          scale: "1.02",
        }}
      >
        <div className="absolute inset-0">
          <Image
            src="/hero.png"
            alt="STC Academy"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-30 md:opacity-35 xl:opacity-25"
          />
        </div>
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-white/30 via-muted/40 to-muted/95 xl:from-muted/60 xl:via-muted/50 xl:to-muted/90" />
    </div>
  );
}
