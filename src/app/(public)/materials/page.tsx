import { StepHorizon } from "@/components/stitch/step-horizon";
import Link from "next/link";
import { ArrowRight, FileText, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/stitch/reveal";
import type { Metadata } from "next";

const title = "Learning Materials - STC Academy | Download Study Resources";
const description = "Resource library for active learners. Download and review class materials published by faculty and admin across all subjects and classes.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["study materials", "learning resources", "STC materials", "download", "educational resources", "Gujarat study materials"],
  alternates: { canonical: "/materials" },
  openGraph: { type: "website", title, description, url: "/materials" },
  twitter: { card: "summary_large_image", title, description },
};

export const revalidate = 300;

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
    <div className="overflow-x-hidden">
      <section className="relative overflow-hidden bg-gold-50 pt-14 pb-24 md:pt-20 md:pb-36">
        <StepHorizon />
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="max-w-3xl">
            <Reveal variant="fade">
              <p className="stitch-kicker">Learning Materials</p>
            </Reveal>
            <Reveal delay={80} variant="mask-up">
              <h1 className="text-4xl font-extrabold leading-[1.05] text-primary md:text-6xl">
                Resource library for active learners.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
                Download and review class materials published by faculty and admin.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        {classOptions.length > 0 ? (
          <Reveal variant="fade">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/materials"
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
                  href={`/materials?class=${item.id}`}
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
              <h2 className="text-4xl text-primary">No Materials Published Yet</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">New resources will appear once published by the admin team.</p>
            </div>
          </Reveal>
        ) : (
          <div className={`${classOptions.length > 0 ? "mt-10" : ""} grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3`}>
            {filteredRows.map((item, index) => (
              <Reveal key={item.id} delay={index * 60} variant="fade-up">
                <a
                  href={item.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="stitch-panel stitch-hover-lift group block cursor-pointer overflow-hidden p-6 sm:p-7"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/15 to-transparent" />
                  <div className="flex items-start justify-between">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-110">
                      {item.type === "video" ? <PlayCircle className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-secondary" />
                  </div>
                  <h2 className="mt-5 text-2xl text-primary sm:text-3xl">{item.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{item.subject}</p>
                  <p className="mt-4 text-xs text-secondary">
                    {item.class?.board ?? "STC"} · {item.class?.name ?? "Class"} · {item.type}
                  </p>
                </a>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal delay={200} variant="fade">
          <div className="mt-14">
            <Link href="/online-courses" className="stitch-press inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground transition">
              Go to Online Courses
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
