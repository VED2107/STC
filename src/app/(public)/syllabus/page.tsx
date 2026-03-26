import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SyllabusRow = {
  id: string;
  subject: string;
  class: { name: string; board: string; level: string } | null;
};

export default async function PublicSyllabusPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("syllabus")
    .select("id, subject, class:classes(name, board, level)")
    .order("subject", { ascending: true })
    .limit(24);

  const rows = (data as SyllabusRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
      <p className="stitch-kicker">Public Syllabus</p>
      <h1 className="mt-4 text-5xl italic text-primary md:text-7xl">
        Live syllabus mapped by class and board.
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
        This page shows the latest syllabus prepared by our teaching team.
      </p>

      {rows.length === 0 ? (
        <div className="stitch-panel mt-12 p-10 text-center">
          <h2 className="text-4xl text-primary">No Syllabus Published Yet</h2>
          <p className="mt-4 text-muted-foreground">Updated syllabus topics will appear here soon.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <article key={item.id} className="stitch-panel p-7">
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
                {item.class?.board ?? "STC"} · Level {item.class?.level ?? "-"}
              </p>
              <h2 className="mt-3 text-3xl text-primary">{item.subject}</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {item.class?.name ?? "Independent Class"}
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="mt-12">
        <Link href="/courses" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white">
          Browse Courses
        </Link>
      </div>
    </div>
  );
}
