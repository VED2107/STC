import Link from "next/link";
import { FileText, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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
    <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
      <p className="stitch-kicker">Public Syllabus</p>
      <h1 className="mt-4 text-5xl italic text-primary md:text-7xl">
        Live syllabus mapped by board, subject, and resources.
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
        This page now reflects the latest materials published by our teaching team for each syllabus track.
      </p>

      {classOptions.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/syllabus"
            className={`rounded-full px-4 py-2 text-sm transition ${
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
              className={`rounded-full px-4 py-2 text-sm transition ${
                selectedClassId === item.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-foreground hover:border-primary/20"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="stitch-panel mt-12 p-10 text-center">
          <h2 className="text-4xl text-primary">No Syllabus Published Yet</h2>
          <p className="mt-4 text-muted-foreground">Updated syllabus topics will appear here soon.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((item) => {
            const linkedMaterials = materialMap[`${item.class_id}::${item.subject.toLowerCase()}`] ?? [];
            return (
              <article key={item.id} className="stitch-panel p-7">
                <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
                  {item.class?.board ?? "STC"} · Level {item.class?.level ?? "-"}
                </p>
                <h2 className="mt-3 text-3xl text-primary">{item.subject}</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.class?.name ?? "Independent Class"}
                </p>
                <div className="mt-6 space-y-3">
                  {linkedMaterials.length > 0 ? linkedMaterials.slice(0, 4).map((material) => (
                    <a
                      key={material.id}
                      href={material.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 transition hover:border-primary/20"
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
            );
          })}
        </div>
      )}

      <div className="mt-12">
        <Link href="/online-courses" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white">
          Browse Online Courses
        </Link>
      </div>
    </div>
  );
}
