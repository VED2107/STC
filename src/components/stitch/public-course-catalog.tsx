"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { stitchInputClass } from "@/components/stitch/primitives";
import {
  type CatalogLevelKey,
  type CatalogTrackKey,
  type PublicCourseRow,
  getCourseLevelKey,
  matchesCatalogLevel,
  matchesCatalogQuery,
  matchesCatalogTrack,
} from "@/lib/course-catalog";
import { cn } from "@/lib/utils";

const filters: Array<{ key: CatalogLevelKey | "jee" | "neet"; label: string }> = [
  { key: "all", label: "All Courses" },
  { key: "primary", label: "Primary" },
  { key: "middle", label: "Middle" },
  { key: "ssc", label: "SSC" },
  { key: "hsc", label: "11th / HSC" },
  { key: "jee", label: "JEE" },
  { key: "neet", label: "NEET" },
];

function levelLabel(course: PublicCourseRow) {
  const key = getCourseLevelKey(course);
  if (key === "primary") return "Primary";
  if (key === "middle") return "Middle";
  if (key === "hsc") return "11th / HSC";
  return "SSC";
}

interface PublicCourseCatalogProps {
  courses: PublicCourseRow[];
  initialLevel: CatalogLevelKey;
  initialTrack: CatalogTrackKey;
  initialQuery: string;
}

export function PublicCourseCatalog({
  courses,
  initialLevel,
  initialTrack,
  initialQuery,
}: PublicCourseCatalogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedLevel, setSelectedLevel] = useState<CatalogLevelKey>(initialLevel);
  const [selectedTrack, setSelectedTrack] = useState<CatalogTrackKey>(initialTrack);
  const deferredQuery = useDeferredValue(searchQuery);

  function updateRoute(next: { level?: CatalogLevelKey; track?: CatalogTrackKey; query?: string }) {
    const params = new URLSearchParams();
    const level = next.level ?? selectedLevel;
    const track = next.track ?? selectedTrack;
    const query = next.query ?? searchQuery;

    if (level !== "all") params.set("level", level);
    if (track) params.set("track", track);
    if (query.trim()) params.set("q", query.trim());

    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  const filtered = courses.filter((course) => {
    if (!matchesCatalogLevel(course, selectedLevel)) return false;
    if (!matchesCatalogTrack(course, selectedTrack)) return false;
    return matchesCatalogQuery(course, deferredQuery);
  });

  const featured = filtered[0] ?? null;
  const remaining = featured ? filtered.slice(1) : [];

  return (
    <>
      <header className="mb-10 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-extrabold leading-[1.05] text-primary md:text-6xl">
            Online courses for every class.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Explore our live curriculum library across primary foundations, board preparation, and senior academic tracks.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);
                updateRoute({ query: nextQuery });
              }}
              aria-label="Search courses"
              className={cn(stitchInputClass, "pl-10")}
              placeholder="Search courses"
            />
          </div>
        </div>
      </header>

      <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 pr-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:gap-3 md:pb-2">
          {filters.map((filter) => {
            const active =
              filter.key === "all"
                ? selectedLevel === "all" && !selectedTrack
                : filter.key === "jee" || filter.key === "neet"
                  ? selectedLevel === "hsc" && selectedTrack === filter.key
                  : selectedLevel === filter.key && !selectedTrack;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  if (filter.key === "jee" || filter.key === "neet") {
                    setSelectedLevel("hsc");
                    setSelectedTrack(filter.key);
                    updateRoute({ level: "hsc", track: filter.key });
                    return;
                  }

                  setSelectedLevel(filter.key);
                  setSelectedTrack("");
                  updateRoute({ level: filter.key, track: "" });
                }}
                className={cn(
                  "stitch-press min-h-10 shrink-0 snap-start rounded-lg px-4 text-center text-sm font-semibold transition-colors duration-(--duration-fast)",
                  filter.key === "all" ? "min-w-[96px]" : "min-w-[72px]",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-surface-variant",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="text-xs font-semibold text-muted-foreground ">
          {filtered.length} courses
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="stitch-panel p-10 text-center">
          <h2 className="text-4xl text-primary">No Matching Courses</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            Try another keyword or switch to a different track.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 lg:gap-10">
          {featured ? (
            <Link href={`/online-courses/${featured.id}`} className="group md:col-span-8">
              <article className="stitch-panel stitch-hover-lift flex h-full flex-col overflow-hidden md:flex-row">
                <div className="relative h-72 md:h-auto md:w-1/2">
                  {featured.thumbnail_url ? (
                    <Image
                      src={featured.thumbnail_url}
                      alt={featured.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gold-50">
                      <span aria-hidden="true" className="size-28 rounded-full bg-accent" />
                    </div>
                  )}
                  <div className="absolute left-6 top-6 flex flex-wrap gap-2">
                    <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary">
                      {featured.class?.board ?? "STC"}
                    </span>
                    <span className="rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-accent-foreground">
                      {levelLabel(featured)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-center p-8 md:p-12">
                  <span className="text-xs font-semibold text-secondary">
                    Featured course
                  </span>
                  <h2 className="mt-2 text-3xl leading-tight text-primary md:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-5 text-base leading-8 text-muted-foreground">
                    {featured.description}
                  </p>
                  <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                    <div className="text-sm text-muted-foreground">
                      {[featured.subject, featured.teacher?.name ?? "STC Faculty"].join(" - ")}
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      View Course
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ) : null}

          {remaining.map((course) => (
            <Link key={course.id} href={`/online-courses/${course.id}`} className="group md:col-span-4">
              <article className="stitch-panel stitch-hover-lift h-full p-6">
                <div className="flex items-start justify-end">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {course.class?.board ?? "STC"}
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl leading-snug text-primary">
                    {course.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{course.description}</p>
                </div>
                <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
                  {[course.class?.name ?? levelLabel(course), course.subject].join(" - ")}
                </div>
                {matchesCatalogTrack(course, "jee") ? (
                  <div className="mt-3 text-xs font-semibold text-secondary">JEE track</div>
                ) : null}
                {matchesCatalogTrack(course, "neet") ? (
                  <div className="mt-3 text-xs font-semibold text-secondary">NEET track</div>
                ) : null}
              </article>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
