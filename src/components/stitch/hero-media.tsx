"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export function HeroMedia() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const allowMotionRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    allowMotionRef.current = !mediaQuery.matches;

    const applyMotionPreference = () => {
      allowMotionRef.current = !mediaQuery.matches;
      if (!allowMotionRef.current && el) {
        el.style.transform = "translate3d(0,0,0) scale(1)";
      }
    };

    const onScroll = () => {
      if (!allowMotionRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY * 0.08, 48);
        if (el) {
          el.style.transform = `translate3d(0,${offset}px,0) scale(1.04)`;
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    mediaQuery.addEventListener("change", applyMotionPreference);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
      mediaQuery.removeEventListener("change", applyMotionPreference);
    };
  }, []);

  return (
    <div className="absolute inset-y-0 right-0 hidden w-[32%] overflow-hidden xl:block">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          transformOrigin: "center center",
          willChange: "transform",
          contain: "layout style paint",
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
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-muted/35" />
    </div>
  );
}
