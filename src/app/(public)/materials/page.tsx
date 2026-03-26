import Link from "next/link";
import { FileText, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type MaterialRow = {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video";
  subject: string;
  file_url: string;
  class: { name: string; board: string; level: string } | null;
};

export default async function PublicMaterialsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select("id, title, type, subject, file_url, class:classes(name, board, level)")
    .order("created_at", { ascending: false })
    .limit(24);

  const rows = (data as MaterialRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
      <p className="stitch-kicker">Learning Materials</p>
      <h1 className="mt-4 text-5xl italic text-primary md:text-7xl">
        Resource library for active learners.
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
        Download and review class materials published by faculty and admin.
      </p>

      {rows.length === 0 ? (
        <div className="stitch-panel mt-12 p-10 text-center">
          <h2 className="text-4xl text-primary">No Materials Published Yet</h2>
          <p className="mt-4 text-muted-foreground">New resources will appear once published by the admin team.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
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
        <Link href="/courses" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white">
          Go to Courses
        </Link>
      </div>
    </div>
  );
}
