"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ImageOff, Search } from "lucide-react";
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
      <header className="mb-16 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="stitch-kicker">Academic Catalog</p>
          <h1 className="mt-4 text-5xl font-light italic leading-tight text-primary md:text-7xl">
            Curated paths for the <span className="text-secondary">Modern Scholar</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Explore our live curriculum library across primary foundations, board preparation, and senior academic tracks.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="relative rounded-full bg-muted px-4 stitch-ghost-border">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);
                updateRoute({ query: nextQuery });
              }}
              className={cn(stitchInputClass, "border-0 bg-transparent pl-8 shadow-none")}
              placeholder="Search curriculum..."
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
                  "shrink-0 snap-start rounded-full px-4 py-3 text-center text-[10px] font-semibold uppercase leading-4 tracking-[0.16em] whitespace-normal transition sm:text-[11px] md:px-6 md:py-2 md:tracking-[0.18em]",
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
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground md:text-[11px] md:tracking-[0.18em]">
          Displaying {filtered.length} available modules
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="stitch-panel p-10 text-center">
          <h2 className="text-4xl italic text-primary">No Matching Courses</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            Try another keyword or switch to a different track.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 lg:gap-10">
          {featured ? (
            <Link href={`/online-courses/${featured.id}`} className="group md:col-span-8">
              <article className="stitch-panel flex h-full flex-col overflow-hidden md:flex-row">
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
                    <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
                      <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                        <ImageOff className="h-4 w-4" />
                        Thumbnail Unavailable
                      </span>
                    </div>
                  )}
                  <div className="absolute left-6 top-6 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      {featured.class?.board ?? "STC"}
                    </span>
                    <span className="rounded-full bg-accent/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-foreground">
                      {levelLabel(featured)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-center p-8 md:p-12">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">
                    Featured Module
                  </span>
                  <h2 className="mt-4 text-4xl font-normal italic leading-tight text-primary md:text-5xl">
                    {featured.title}
                  </h2>
                  <p className="mt-5 text-base leading-8 text-muted-foreground">
                    {featured.description}
                  </p>
                  <div className="mt-8 flex items-center justify-between border-t border-black/6 pt-6">
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
              <article className="stitch-panel h-full p-8 transition group-hover:-translate-y-1">
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-secondary">
                    <Search className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {course.class?.board ?? "STC"}
                  </span>
                </div>
                <div className="mt-10">
                  <h3 className="text-3xl font-normal italic leading-snug text-primary">
                    {course.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{course.description}</p>
                </div>
                <div className="mt-8 border-t border-black/6 pt-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {[course.class?.name ?? levelLabel(course), course.subject].join(" - ")}
                </div>
                {matchesCatalogTrack(course, "jee") ? (
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">JEE track</div>
                ) : null}
                {matchesCatalogTrack(course, "neet") ? (
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">NEET track</div>
                ) : null}
              </article>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
