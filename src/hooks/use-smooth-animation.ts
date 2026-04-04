"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * High-performance intersection reveal using Web Animations API (WAAPI).
 * WAAPI animations run on the compositor thread → guaranteed 60-120fps.
 *
 * Falls back to data-visible for prefers-reduced-motion.
 */
export function useSmoothReveal<T extends HTMLElement = HTMLDivElement>(
  variant: "fade-up" | "fade" | "mask-up" | "soft-zoom" = "fade-up",
  delay = 0,
  threshold = 0.15,
  duration = 900
) {
  const ref = useRef<T | null>(null);

  const kickAnimation = useCallback(
    (el: HTMLElement) => {
      // Build from → to keyframes per variant
      const from: Keyframe = { opacity: 0 };
      const to: Keyframe = { opacity: 1 };

      switch (variant) {
        case "fade":
          break; // opacity only
        case "fade-up":
          from.transform = "translate3d(0, 28px, 0)";
          to.transform = "translate3d(0, 0, 0)";
          break;
        case "mask-up":
          from.transform = "translate3d(0, 40px, 0)";
          from.filter = "blur(8px)";
          to.transform = "translate3d(0, 0, 0)";
          to.filter = "blur(0px)";
          break;
        case "soft-zoom":
          from.transform = "translate3d(0, 18px, 0) scale(0.985)";
          from.filter = "blur(6px)";
          to.transform = "translate3d(0, 0, 0) scale(1)";
          to.filter = "blur(0px)";
          break;
      }

      const anim = el.animate([from, to], {
        duration,
        delay,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)", // expo-out — premium decel
        fill: "forwards",
        composite: "replace",
      });

      // After animation completes, apply final styles directly and clean up
      anim.finished
        .then(() => {
          el.style.opacity = "1";
          el.style.transform = "none";
          el.style.filter = "none";
          el.dataset.visible = "true";
          // Release any will-change to free VRAM
          el.style.willChange = "auto";
        })
        .catch(() => {
          // animation was cancelled (element removed), safe to ignore
        });
    },
    [variant, delay, duration]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: instantly visible
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.filter = "none";
      el.dataset.visible = "true";
      return;
    }

    // Set initial hidden state
    el.style.opacity = "0";

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            kickAnimation(entry.target as HTMLElement);
            obs.unobserve(entry.target);
          }
        }
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, kickAnimation]);

  return ref;
}

/**
 * Smooth counter animation using requestAnimationFrame.
 * Animates a number from 0 to `target` over `duration` ms.
 * Only starts when the element enters the viewport.
 */
export function useCountUp<T extends HTMLElement = HTMLElement>(
  target: number,
  duration = 1800,
  threshold = 0.3
) {
  const ref = useRef<T | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasAnimated.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = String(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            obs.unobserve(entry.target);
            animateValue(entry.target as HTMLElement, 0, target, duration);
          }
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, threshold]);

  return ref;
}

function animateValue(
  el: HTMLElement,
  start: number,
  end: number,
  dur: number
) {
  let startTime: number | null = null;

  function step(timestamp: number) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / dur, 1);
    // Use easeOutExpo for natural feel
    const eased = 1 - Math.pow(1 - progress, 4);
    const current = Math.round(start + (end - start) * eased);
    el.textContent = String(current);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

/**
 * Magnetic hover effect for buttons/cards.
 * On mouse move near the element, it subtly shifts toward the cursor.
 * Uses transform (compositor-only) for 120fps.
 */
export function useMagneticHover<T extends HTMLElement = HTMLElement>(strength = 0.3) {
  const ref = useRef<T | null>(null);
  const rafId = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMouseMove = (e: MouseEvent) => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) * strength;
        const dy = (e.clientY - cy) * strength;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
    };

    const onMouseLeave = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      // Spring-like return to origin
      el.style.transition = "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transform = "translate3d(0, 0, 0)";
      // Remove transition after it completes so hover doesn't lag
      const tid = setTimeout(() => {
        el.style.transition = "";
      }, 620);
      return () => clearTimeout(tid);
    };

    el.addEventListener("mousemove", onMouseMove, { passive: true });
    el.addEventListener("mouseleave", onMouseLeave, { passive: true });

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [strength]);

  return ref;
}

/**
 * Parallax scroll effect using requestAnimationFrame.
 * Applies a transform based on scroll offset.
 * Compositor-only → buttery 60-120fps.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(speed = 0.08, maxOffset = 48) {
  const ref = useRef<T | null>(null);
  const rafId = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Promote to compositor layer
    el.style.willChange = "transform";
    el.style.backfaceVisibility = "hidden";

    const onScroll = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const viewportH = window.innerHeight;
        // Element position relative to viewport center
        const centerOfEl = rect.top + rect.height / 2;
        const distFromCenter = centerOfEl - viewportH / 2;
        const offset = Math.max(
          -maxOffset,
          Math.min(maxOffset, distFromCenter * speed)
        );
        el.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // run once

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      window.removeEventListener("scroll", onScroll);
      el.style.willChange = "auto";
    };
  }, [speed, maxOffset]);

  return ref;
}
