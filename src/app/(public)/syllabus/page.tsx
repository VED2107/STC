import Link from "next/link";
import { ArrowRight, FileText, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/stitch/reveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syllabus - STC Academy | Live Curriculum by Board & Subject",
  description: "Live syllabus mapped by board, subject, and resources. Reflects the latest materials published by our teaching team for each syllabus track.",
  keywords: ["syllabus", "curriculum", "GSEB syllabus", "CBSE syllabus", "study materials", "STC Academy syllabus"],
  alternates: { canonical: "/syllabus" },
};

export const revalidate = 300;

type SyllabusRow = {
  id: string;
  class_id: string;
  subject: string;
  class: { name: string; board: string; level: string } | null;
};

type MaterialRow = {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video" | "link";
  subject: string;
  class_id: string;
  file_url: string;
};

type SearchParams = Promise<{
  class?: string | string[];
}>;

export default async function PublicSyllabusPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedClassId = Array.isArray(resolvedSearchParams.class)
    ? resolvedSearchParams.class[0]
    : resolvedSearchParams.class;

  const supabase = await createClient();
  const { data } = await supabase
    .from("syllabus")
    .select("id, class_id, subject, class:classes(name, board, level)")
    .order("subject", { ascending: true })
    .limit(48);

  const rows = (data as SyllabusRow[] | null) ?? [];
  const filteredRows = selectedClassId
    ? rows.filter((item) => item.class_id === selectedClassId)
    : rows;
  const classOptions = Array.from(
    new Map(
      rows
        .filter((item) => item.class)
        .map((item) => [item.class_id, { id: item.class_id, name: item.class?.name ?? "Class" }]),
    ).values(),
  );
  const classIds = Array.from(new Set(filteredRows.map((item) => item.class_id)));

  let materials: MaterialRow[] = [];
  if (classIds.length > 0) {
    const { data: materialData } = await supabase
      .from("materials")
      .select("id, title, type, subject, class_id, file_url")
      .in("class_id", classIds)
      .order("sort_order");
    materials = (materialData as MaterialRow[] | null) ?? [];
  }

  const materialMap = materials.reduce<Record<string, MaterialRow[]>>((accumulator, item) => {
    const key = `${item.class_id}::${item.subject.toLowerCase()}`;
    const existing = accumulator[key] ?? [];
    existing.push(item);
    accumulator[key] = existing;
    return accumulator;
  }, {});

  return (
    <div className="overflow-x-hidden">
      <section className="relative bg-muted py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 md:px-12">
          <div className="max-w-3xl">
            <Reveal variant="fade">
              <p className="stitch-kicker">Public Syllabus</p>
            </Reveal>
            <Reveal delay={80} variant="mask-up">
              <h1 className="mt-4 text-5xl font-light italic leading-tight text-primary md:text-7xl xl:text-8xl">
                Live syllabus mapped by <span className="text-secondary">board & subject</span>.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-8 max-w-2xl text-base font-light leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
                Reflects the latest materials published by our teaching team for each syllabus track.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-6 py-24 md:px-12 md:py-32">
        {classOptions.length > 0 ? (
          <Reveal variant="fade">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/syllabus"
                className={`cursor-pointer rounded-full px-4 py-2 text-sm transition ${
                  !selectedClassId
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-foreground hover:border-primary/20"
                }`}
              >
                All classes
              </Link>
              {classOptions.map((item) => (
                <Link
                  key={item.id}
                  href={`/syllabus?class=${item.id}`}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm transition ${
                    selectedClassId === item.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-foreground hover:border-primary/20"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </Reveal>
        ) : null}

        {filteredRows.length === 0 ? (
          <Reveal variant="soft-zoom">
            <div className="stitch-panel mt-12 p-10 text-center">
              <h2 className="text-4xl italic text-primary">No Syllabus Published Yet</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">Updated syllabus topics will appear here soon.</p>
            </div>
          </Reveal>
        ) : (
          <div className={`${classOptions.length > 0 ? "mt-10" : ""} grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3`}>
            {filteredRows.map((item, index) => {
              const linkedMaterials = materialMap[`${item.class_id}::${item.subject.toLowerCase()}`] ?? [];
              return (
                <Reveal key={item.id} delay={index * 60} variant="fade-up">
                  <article className="stitch-panel relative overflow-hidden p-6 sm:p-7">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/15 to-transparent" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary">
                      {item.class?.board ?? "STC"} · Level {item.class?.level ?? "-"}
                    </p>
                    <h2 className="mt-3 text-2xl italic text-primary sm:text-3xl">{item.subject}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {item.class?.name ?? "Independent Class"}
                    </p>
                    <div className="mt-6 space-y-2">
                      {linkedMaterials.length > 0 ? linkedMaterials.slice(0, 4).map((material) => (
                        <a
                          key={material.id}
                          href={material.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex cursor-pointer items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_8px_20px_-12px_rgba(26,28,29,0.12)]"
                        >
                          <div className="flex items-center gap-3">
                            {material.type === "video" ? (
                              <PlayCircle className="h-4 w-4 text-primary" />
                            ) : (
                              <FileText className="h-4 w-4 text-primary" />
                            )}
                            <span className="text-sm text-foreground">{material.title}</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {material.type}
                          </span>
                        </a>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                          No materials published yet for this subject.
                        </div>
                      )}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}

        <Reveal delay={200} variant="fade">
          <div className="mt-14">
            <Link href="/online-courses" className="stitch-press inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(26,28,29,0.35)]">
              Browse Online Courses
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
