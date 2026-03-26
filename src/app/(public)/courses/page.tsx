import { PublicCourseCatalog } from "@/components/stitch/public-course-catalog";
import {
  getCatalogQuery,
  normalizeCatalogLevel,
  normalizeCatalogTrack,
  type PublicCourseRow,
} from "@/lib/course-catalog";
import { createClient } from "@/lib/supabase/server";

type CoursesPageProps = {
  searchParams: Promise<{
    level?: string | string[];
    track?: string | string[];
    q?: string | string[];
  }>;
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  const { data } = await supabase
    .from("courses")
    .select(
      `
        *,
        class:classes(id, name, board, level, sort_order),
        teacher:teachers(name)
      `,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8 md:py-18">
      <PublicCourseCatalog
        key={`${normalizeCatalogLevel(params.level)}:${normalizeCatalogTrack(params.track)}:${getCatalogQuery(params.q)}`}
        courses={(data as PublicCourseRow[] | null) ?? []}
        initialLevel={normalizeCatalogLevel(params.level)}
        initialTrack={normalizeCatalogTrack(params.track)}
        initialQuery={getCatalogQuery(params.q)}
      />
    </div>
  );
}
