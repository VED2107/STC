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
    <div className="absolute inset-y-0 right-0 hidden w-[32%] overflow-hidden xl:block">
      <div
        ref={parallaxRef}
        className="absolute inset-0"
        style={{
          transformOrigin: "center center",
          contain: "layout style paint",
          // slight zoom for parallax reveal
          scale: "1.06",
        }}
      >
        <Image
          src="/hero.png"
          alt="STC learning environment"
          fill
          priority
          sizes="32vw"
          className="object-cover object-center"
        />
      </div>
      <div className="absolute inset-0 bg-linear-to-l from-transparent via-transparent to-muted/35" />
    </div>
  );
}
