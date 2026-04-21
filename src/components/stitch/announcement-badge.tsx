"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/**
 * A premium animated announcement badge with shimmer effect,
 * floating sparkles, and a gentle pulse glow.
 */
export function AnnouncementBadge() {
  const badgeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = badgeRef.current;
    if (!el) return;

    // Randomize sparkle positions on mount for organic feel
    const sparkles = el.querySelectorAll<HTMLElement>("[data-sparkle]");
    sparkles.forEach((s, i) => {
      const delay = i * 1.2 + Math.random() * 0.6;
      s.style.animationDelay = `${delay}s`;
    });
  }, []);

  return (
    <Link
      ref={badgeRef}
      href="/login"
      className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-[#d4a017]/30 bg-linear-to-r from-[#fef9e7]/90 via-white/95 to-[#fef3c7]/90 px-4 py-2 shadow-[0_0_20px_rgba(212,160,23,0.12),0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all duration-500 hover:border-[#d4a017]/50 hover:shadow-[0_0_32px_rgba(212,160,23,0.22),0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 sm:gap-3.5 sm:px-5 sm:py-2.5"
    >
      {/* Shimmer sweep */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-linear-to-r from-transparent via-[#d4a017]/10 to-transparent" />

      {/* Pulse glow ring */}
      <span className="pointer-events-none absolute -inset-[2px] animate-[pulse-glow_2.5s_ease-in-out_infinite] rounded-full border border-[#d4a017]/0" />

      {/* Live indicator dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4a017]/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-linear-to-br from-[#f59e0b] to-[#d4a017] shadow-[0_0_6px_rgba(212,160,23,0.5)]" />
      </span>

      {/* Text content */}
      <span className="relative flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#92700c] sm:text-xs sm:tracking-[0.24em]">
        <span className="hidden sm:inline">🎓</span>
        <span>Admissions Open</span>
        <span className="font-heading text-sm font-bold italic tracking-tight text-[#b8860b] sm:text-base">2026</span>
      </span>

      {/* Arrow */}
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-[#f59e0b] to-[#d4a017] text-white shadow-[0_2px_8px_rgba(212,160,23,0.3)] transition-transform duration-300 group-hover:scale-110 sm:h-7 sm:w-7">
        <svg
          className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </span>

      {/* Floating sparkles */}
      <span data-sparkle className="pointer-events-none absolute left-[15%] top-[10%] h-1 w-1 animate-[sparkle_2.8s_ease-in-out_infinite] rounded-full bg-[#d4a017]/50" />
      <span data-sparkle className="pointer-events-none absolute right-[20%] top-[15%] h-1.5 w-1.5 animate-[sparkle_3.2s_ease-in-out_infinite] rounded-full bg-[#f59e0b]/40" />
      <span data-sparkle className="pointer-events-none absolute bottom-[12%] left-[35%] h-1 w-1 animate-[sparkle_2.4s_ease-in-out_infinite] rounded-full bg-[#d4a017]/35" />
    </Link>
  );
}
