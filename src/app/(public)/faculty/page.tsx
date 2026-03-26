import { createClient } from "@/lib/supabase/server";
import { ImageOff } from "lucide-react";

type TeacherRow = {
  id: string;
  name: string;
  subject: string;
  qualification: string;
  bio: string | null;
  photo_url: string | null;
};

export default async function FacultyPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("teachers").select("*").order("name");
  const teachers = (data as TeacherRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
      <div className="max-w-3xl">
        <p className="stitch-kicker">Faculty Directory</p>
        <h1 className="mt-4 text-5xl font-light italic leading-tight text-primary md:text-7xl">
          Fellows guiding the <span className="text-secondary">Modern Scholar</span>.
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Meet the academic team shaping the live curriculum across board preparation,
          foundational study, and higher-secondary pathways.
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="stitch-panel mt-12 p-10 text-center">
          <h2 className="text-4xl italic text-primary">Faculty List Coming Soon</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            Teachers added from the admin desk will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-14 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {teachers.map((teacher) => (
            <article key={teacher.id} className="stitch-panel overflow-hidden p-8">
              <div className="overflow-hidden rounded-[20px] stitch-ghost-border">
                {teacher.photo_url ? (
                  <img
                    src={teacher.photo_url}
                    alt={teacher.name}
                    className="aspect-[1.1] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[1.1] w-full items-center justify-center bg-muted text-muted-foreground">
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                      <ImageOff className="h-4 w-4" />
                      Photo Unavailable
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
                  {teacher.subject}
                </p>
                <h2 className="mt-3 text-4xl italic text-primary">{teacher.name}</h2>
                <p className="mt-3 text-sm font-medium text-foreground/70">{teacher.qualification}</p>
                <p className="mt-5 text-sm leading-7 text-muted-foreground">
                  {teacher.bio || "A member of the STC faculty, committed to clarity, rigor, and student progress."}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
