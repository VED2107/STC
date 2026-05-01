import Link from "next/link";
import { FileText, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type MaterialRow = {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video" | "link";
  subject: string;
  file_url: string;
  class_id: string;
  class: { name: string; board: string; level: string } | null;
};

type SearchParams = Promise<{
  class?: string | string[];
}>;

export default async function PublicMaterialsPage({
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
    .from("materials")
    .select("id, title, type, subject, file_url, class_id, class:classes(name, board, level)")
    .order("created_at", { ascending: false })
    .limit(48);

  const rows = (data as MaterialRow[] | null) ?? [];
  const classOptions = Array.from(
    new Map(
      rows
        .filter((item) => item.class)
        .map((item) => [item.class_id, { id: item.class_id, name: item.class?.name ?? "Class" }]),
    ).values(),
  );

  const filteredRows = selectedClassId
    ? rows.filter((item) => item.class_id === selectedClassId)
    : rows;

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
      <p className="stitch-kicker">Learning Materials</p>
      <h1 className="mt-4 text-5xl italic text-primary md:text-7xl">
        Resource library for active learners.
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
        Download and review class materials published by faculty and admin.
      </p>

      {classOptions.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/materials"
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
              href={`/materials?class=${item.id}`}
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
          <h2 className="text-4xl text-primary">No Materials Published Yet</h2>
          <p className="mt-4 text-muted-foreground">New resources will appear once published by the admin team.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((item) => (
            <a
              key={item.id}
              href={item.file_url}
              target="_blank"
              rel="noreferrer"
              className="stitch-panel p-7 transition hover:border-primary/20"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                {item.type === "video" ? <PlayCircle className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
              </span>
              <h2 className="mt-4 text-3xl text-primary">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.subject}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-secondary">
                {item.class?.board ?? "STC"} · {item.class?.name ?? "Class"} · {item.type}
              </p>
            </a>
          ))}
        </div>
      )}

      <div className="mt-12">
        <Link href="/online-courses" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white">
          Go to Online Courses
        </Link>
      </div>
    </div>
  );
}
