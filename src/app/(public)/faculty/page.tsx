import { StepHorizon } from "@/components/stitch/step-horizon";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/stitch/reveal";
import { PersonJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";

const title = "Faculty Directory - STC Academy | Expert Teachers & Mentors";
const description = "Meet the academic team shaping the live curriculum across board preparation, foundational study, and higher-secondary pathways at STC Academy.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["STC faculty", "teachers", "mentors", "expert faculty", "Gujarat teachers", "academic team"],
  alternates: { canonical: "/faculty" },
  openGraph: { type: "website", title, description, url: "/faculty" },
  twitter: { card: "summary_large_image", title, description },
};

export const revalidate = 300;

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
  const { data } = await supabase
    .from("teachers")
    .select("id, name, subject, qualification, bio, photo_url")
    .order("name");
  const teachers = (data as TeacherRow[] | null) ?? [];

  return (
    <div className="overflow-x-hidden">
      <section className="relative overflow-hidden bg-gold-50 pt-14 pb-24 md:pt-20 md:pb-36">
        <StepHorizon />
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="max-w-3xl">
            <Reveal variant="fade">
              <p className="stitch-kicker">Faculty Directory</p>
            </Reveal>
            <Reveal delay={80} variant="mask-up">
              <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] text-primary md:text-6xl">
                Meet your teachers.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
                Meet the academic team shaping the live curriculum across board preparation,
                foundational study, and higher-secondary pathways.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        {teachers.length === 0 ? (
          <Reveal variant="soft-zoom">
            <div className="stitch-panel p-10 text-center">
              <h2 className="text-4xl text-primary">Faculty List Coming Soon</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Teachers added from the admin desk will appear here automatically.
              </p>
            </div>
          </Reveal>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {teachers.map((teacher, index) => (
              <Reveal key={teacher.id} delay={index * 80} variant="fade-up">
                <PersonJsonLd
                  name={teacher.name}
                  jobTitle={`${teacher.subject} Teacher`}
                  description={[teacher.qualification, teacher.bio].filter(Boolean).join(" — ") || null}
                  image={teacher.photo_url}
                />
                <article className="stitch-panel stitch-hover-lift group overflow-hidden p-6 sm:p-8">
                  <div className="overflow-hidden rounded-xl stitch-ghost-border">
                    {teacher.photo_url ? (
                      <Image
                        src={teacher.photo_url}
                        alt={teacher.name}
                        width={400}
                        height={440}
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="aspect-[1.1] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex aspect-[1.6] w-full items-center justify-center bg-gold-50">
                        <span aria-hidden="true" className="flex size-24 items-center justify-center rounded-full bg-accent font-heading text-3xl font-bold text-primary">
                          {teacher.name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-secondary">
                      {teacher.subject}
                    </p>
                    <h2 className="mt-3 text-3xl text-primary sm:text-4xl">{teacher.name}</h2>
                    <p className="mt-3 text-sm font-medium text-foreground/70">{teacher.qualification}</p>
                    <p className="mt-5 text-sm leading-7 text-muted-foreground">
                      {teacher.bio || "A member of the STC faculty, committed to clarity, rigor, and student progress."}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
