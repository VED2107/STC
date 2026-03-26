"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function HeroMedia() {
  const [offsetY, setOffsetY] = useState(0);
  const [allowMotion, setAllowMotion] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const applyMotionPreference = () => setAllowMotion(!mediaQuery.matches);
    applyMotionPreference();

    let raf = 0;
    const onScroll = () => {
      if (!allowMotion) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = Math.min(window.scrollY * 0.08, 48);
        setOffsetY(next);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    mediaQuery.addEventListener("change", applyMotionPreference);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      mediaQuery.removeEventListener("change", applyMotionPreference);
    };
  }, [allowMotion]);

  const transform = allowMotion
    ? `translate3d(0, ${offsetY}px, 0) scale(1.04)`
    : "translate3d(0, 0, 0) scale(1)";

  return (
    <div className="absolute inset-y-0 right-0 hidden w-[32%] overflow-hidden xl:block">
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform, transformOrigin: "center center" }}
      >
        <Image
          src="/hero.png"
          alt="STC learning environment"
          fill
          priority
          className="object-cover object-center"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-muted/35" />
    </div>
  );
}
