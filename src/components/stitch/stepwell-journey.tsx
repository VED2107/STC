"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const levels = [
  {
    title: "Primary",
    range: "Classes 1 to 5",
    description: "Curiosity-led foundations with reading, numeracy, and confidence building.",
    href: "/online-courses?level=primary",
  },
  {
    title: "Middle",
    range: "Classes 6 to 8",
    description: "Analytical growth across science, mathematics, and language mastery.",
    href: "/online-courses?level=middle",
  },
  {
    title: "SSC",
    range: "Board preparation",
    description: "Board-prep discipline and exam confidence for secondary milestones.",
    href: "/online-courses?level=ssc",
  },
  {
    title: "11th and HSC",
    range: "Science and Commerce",
    description: "Senior academic tracks for science and commerce, with optional competitive-exam focus.",
    href: "/online-courses?level=hsc",
  },
  {
    title: "JEE and NEET",
    range: "Entrance preparation",
    description: "Focused preparation pathways layered into HSC study with precision mentoring.",
    href: "/online-courses?level=hsc",
  },
];

// A stepwell in section: each tread is one level, climbing left to right.
const treads = [
  "M20 340 H110",
  "M110 340 V280 H200",
  "M200 280 V220 H290",
  "M290 220 V160 H380",
  "M380 160 V100 H470",
];

/**
 * Scroll-driven walk up the class ladder. The server renders a plain readable list;
 * on large screens with motion allowed, CSS turns it into a sticky stage and GSAP scrubs it.
 * Everything is written straight to the DOM, so scrolling never re-renders React.
 */
export function StepwellJourney() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const query = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    if (!query.matches) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    // GSAP only loads for people who will actually see this.
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        const paths = gsap.utils.toArray<SVGPathElement>("[data-tread]", root);
        const fills = gsap.utils.toArray<SVGRectElement>("[data-fill]", root);
        const panels = gsap.utils.toArray<HTMLElement>("[data-panel]", root);

        paths.forEach((path) => {
          const length = path.getTotalLength();
          gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        });
        const sun = root.querySelector<SVGCircleElement>("[data-sun]");
        const seat = (index: number) => ({ x: 65 + index * 90, y: 316 - index * 60 });
        gsap.set(fills, { opacity: 0 });
        if (sun) gsap.set(sun, seat(0));
        gsap.set(panels.slice(1), { autoAlpha: 0, yPercent: 8 });

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.4,
          },
        });

        levels.forEach((_, index) => {
          const at = index;
          // The sun hops up to each new tread as you scroll.
          if (sun && index > 0) {
            const { x, y } = seat(index);
            timeline.to(sun, { x, duration: 0.5, ease: "power1.inOut" }, at);
            timeline.to(sun, { y: y - 44, duration: 0.3, ease: "power2.out" }, at);
            timeline.to(sun, { y, duration: 0.2, ease: "power2.in" }, at + 0.3);
          }
          timeline.to(paths[index], { strokeDashoffset: 0, duration: 0.6 }, at);
          timeline.to(fills[index], { opacity: 1, duration: 0.3 }, at + 0.3);
          if (index > 0) {
            timeline.to(panels[index - 1], { autoAlpha: 0, yPercent: -8, duration: 0.2 }, at - 0.2);
            timeline.to(panels[index], { autoAlpha: 1, yPercent: 0, duration: 0.2 }, at);
          }
        });
        // Hold the last step for a moment before the section leaves.
        timeline.to({}, { duration: 0.5 });
      }, root);

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section ref={rootRef} aria-labelledby="journey-title" className="stepwell mt-14 border-y bg-background text-primary">
      <div className="stepwell-stage mx-auto max-w-[1280px] px-4 py-16 md:px-8 lg:py-0">
        <h2 id="journey-title" className="max-w-2xl text-4xl lg:text-5xl">
          The same school, every year you climb
        </h2>

        <div className="stepwell-grid mt-8">
          <svg viewBox="0 0 490 360" aria-hidden="true" className="stepwell-art hidden w-full overflow-visible lg:block">
            {treads.map((d, index) => (
              <g key={d}>
                <rect data-fill x={20 + index * 90} y={340 - index * 60} width="90" height={index * 60 + 20} fill={["var(--gold-50)", "var(--gold-100)", "var(--gold-200)", "var(--gold-300)", "#ffda66"][index]} />
                <path data-tread d={d} fill="none" stroke="var(--secondary)" strokeWidth="3" strokeLinecap="square" />
              </g>
            ))}
            {/* Rests on the top step when nothing is driving it. */}
            <circle data-sun r="22" fill="var(--accent)" transform="translate(425 76)" />
          </svg>

          <ol className="stepwell-panels grid gap-8">
            {levels.map((level, index) => (
              <li key={level.title} data-panel className="stepwell-panel border-t pt-5 lg:border-0 lg:pt-0">
                <p className="font-medium text-secondary">{level.range}</p>
                <h3 className="mt-1 text-4xl font-bold lg:text-7xl">{level.title}</h3>
                <p className="mt-3 max-w-md text-lg leading-8 text-muted-foreground">{level.description}</p>
                <Link href={level.href} className="mt-4 inline-block font-semibold text-secondary underline underline-offset-4">
                  See {level.title} courses
                </Link>
                <div aria-hidden="true" className="stepwell-dots mt-8 hidden gap-1.5">
                  {levels.map((_, dot) => (
                    <span key={dot} className={dot <= index ? "h-1 w-8 bg-accent" : "h-1 w-8 bg-muted"} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
