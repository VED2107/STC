"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SunStep {
  title: string;
  range: string;
  href: string;
}

// Every step shares one rise (5rem) and one width, so the staircase is exact.
const heights = ["lg:h-32", "lg:h-52", "lg:h-72", "lg:h-92", "lg:h-112"];
const insets = ["mr-[32%]", "mr-[24%]", "mr-[16%]", "mr-[8%]", "mr-0"];
const tints = [
  "bg-gold-50 lg:before:bg-gold-50",
  "bg-gold-100",
  "bg-gold-200",
  "bg-gold-300",
  "bg-[#ffda66] lg:after:bg-[#ffda66]",
];

const HOP_MS = 420;
const CLIMB_START_MS = 520;

/**
 * The class ladder as a staircase, with one sun that hops to whichever level you
 * point at or tab to. It climbs all five steps once on load. Position is written
 * straight to the element, so nothing re-renders while it moves.
 *
 * On desktop the steps sit on an equal five-column grid inside the page container.
 * The grid is pulled out by exactly one step's padding, so the first step's text lines
 * up with the headline and the last arrow with the header's right edge. Colour then
 * bleeds from the first and last steps to the screen edges.
 */
export function SunStairs({ steps }: { steps: SunStep[] }) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const sunRef = useRef<HTMLSpanElement | null>(null);
  const discRef = useRef<HTMLSpanElement | null>(null);
  const currentRef = useRef(0);

  useEffect(() => {
    const list = listRef.current;
    const sun = sunRef.current;
    const disc = discRef.current;
    if (!list || !sun || !disc) return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Layout offsets, not bounding boxes: the steps may still be mid-rise on load.
    const place = (index: number) => {
      const item = list.children[index] as HTMLElement | undefined;
      const link = item?.querySelector("a");
      if (!item || !link) return;
      const size = sun.offsetWidth;
      const x = list.offsetLeft + item.offsetLeft + item.offsetWidth / 2 - size / 2;
      const y = list.offsetTop + list.offsetHeight - link.offsetHeight - size;
      sun.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const hopTo = (index: number) => {
      if (index === currentRef.current) return;
      currentRef.current = index;
      place(index);
      if (reduced.matches) return;
      disc.getAnimations().forEach((animation) => animation.cancel());
      disc.animate(
        [
          { transform: "translate3d(0, 0, 0) scale(1.06, 0.92)" },
          { transform: "translate3d(0, -56px, 0) scale(0.97, 1.03)", offset: 0.5, easing: "cubic-bezier(0.32, 0, 0.67, 0)" },
          { transform: "translate3d(0, 0, 0) scale(1.08, 0.9)", offset: 0.92 },
          { transform: "translate3d(0, 0, 0) scale(1, 1)" },
        ],
        { duration: HOP_MS, easing: "cubic-bezier(0.33, 1, 0.68, 1)" },
      );
    };

    const timers: number[] = [];

    if (desktop.matches && !reduced.matches) {
      // First view: the sun starts on the lowest step and climbs to the top.
      sun.style.transition = "none";
      place(0);
      void sun.offsetWidth;
      sun.style.transition = "";
      steps.forEach((_, index) => {
        if (index > 0) timers.push(window.setTimeout(() => hopTo(index), CLIMB_START_MS + (index - 1) * (HOP_MS - 90)));
      });
    } else {
      currentRef.current = steps.length - 1;
      place(steps.length - 1);
    }

    const stepFromEvent = (event: Event) => {
      const item = (event.target as HTMLElement).closest("li");
      if (!item || item.parentElement !== list) return;
      hopTo(Array.prototype.indexOf.call(list.children, item));
    };
    list.addEventListener("pointerover", stepFromEvent);
    list.addEventListener("focusin", stepFromEvent);

    const resize = new ResizeObserver(() => {
      const previous = sun.style.transition;
      sun.style.transition = "none";
      place(currentRef.current);
      void sun.offsetWidth;
      sun.style.transition = previous;
    });
    resize.observe(list);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      list.removeEventListener("pointerover", stepFromEvent);
      list.removeEventListener("focusin", stepFromEvent);
      resize.disconnect();
    };
  }, [steps]);

  return (
    <nav aria-label="Courses by level" className="relative mx-auto mt-10 max-w-[1280px] lg:-mt-12 lg:px-8">
      <span
        ref={sunRef}
        aria-hidden="true"
        className="sun-track pointer-events-none absolute top-0 left-0 z-10 hidden size-24 lg:block"
      >
        <span ref={discRef} className="block size-full origin-bottom rounded-full bg-accent" />
      </span>

      <ol ref={listRef} className="relative flex flex-col lg:-mx-5 lg:grid lg:grid-cols-5 lg:items-end">
        {steps.map((step, index) => (
          <li
            key={step.title}
            style={{ "--i": index } as React.CSSProperties}
            className={cn("step-rise lg:mr-0", insets[index])}
          >
            <Link
              href={step.href}
              className={cn(
                "group relative flex h-20 items-start justify-between gap-2 p-4 text-primary transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:bg-accent focus-visible:outline-offset-[-4px] lg:p-5",
                // Colour past the grid, out to the screen edges. Decorative only.
                index === 0 &&
                  "lg:before:absolute lg:before:inset-y-0 lg:before:right-full lg:before:w-[50vw] lg:before:transition-colors lg:before:duration-(--duration-fast) lg:hover:before:bg-accent",
                index === steps.length - 1 &&
                  "lg:after:absolute lg:after:inset-y-0 lg:after:left-full lg:after:w-[50vw] lg:after:transition-colors lg:after:duration-(--duration-fast) lg:hover:after:bg-accent",
                tints[index],
                heights[index],
              )}
            >
              <span>
                <span className="block font-heading text-xl font-bold leading-tight whitespace-nowrap xl:text-2xl">{step.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground group-hover:text-primary">{step.range}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform duration-(--duration-fast) group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
