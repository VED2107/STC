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
        <div className="absolute inset-x-6 top-8 bottom-[24%] rounded-[28px] bg-white/45 shadow-[0_20px_80px_rgba(0,0,0,0.06)] backdrop-blur-[2px] md:inset-x-10 md:top-10 md:bottom-[28%] xl:inset-x-[15%] xl:top-12 xl:bottom-12">
          <div className="relative h-full w-full">
            <Image
              src="/hero.png"
              alt="STC Academy"
              fill
              priority
              sizes="100vw"
              className="object-contain object-center p-6 opacity-30 md:p-10 md:opacity-35 xl:p-16 xl:opacity-25"
            />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-white/30 via-muted/40 to-muted/95 xl:from-muted/60 xl:via-muted/50 xl:to-muted/90" />
    </div>
  );
}

