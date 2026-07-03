import { createClient } from "@/lib/supabase/server";
import type { Class, Course } from "@/lib/types/database";
import type { Metadata } from "next";
import { CourseDetailClient } from "./client";
import { BreadcrumbJsonLd, CourseJsonLd } from "@/components/seo/json-ld";

export const revalidate = 300;

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
};

type CourseMetadataResult = Pick<Course, "title" | "description" | "subject"> & {
  class: Pick<Class, "name" | "board"> | Pick<Class, "name" | "board">[] | null;
};

type CourseSchemaResult = Pick<Course, "title" | "description" | "subject"> & {
  teacher: { name: string } | { name: string }[] | null;
};

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("title, description, subject, class:classes(name, board)")
    .eq("is_online_only", true)
    .eq("is_active", true)
    .eq("id", id)
    .single()
    .overrideTypes<CourseMetadataResult | null, { merge: false }>();

  if (!course) {
    return {
      title: "Course Not Found - STC Academy",
      description: "The requested course could not be found.",
    };
  }

  const classData = course.class;
  const cls = Array.isArray(classData) ? classData[0] : classData;

  return {
    title: `${course.title} - ${course.subject} | STC Academy`,
    description: course.description || `Learn ${course.subject} with expert faculty at STC Academy. ${cls?.board || "STC"} curriculum for ${cls?.name || "students"}.`,
    keywords: [course.subject, course.title, cls?.board || "STC", cls?.name || "", "online course", "STC Academy"],
    // Shared by /courses/[id] and /online-courses/[id] (identical query) — canonicalize to the nav-linked URL.
    alternates: { canonical: `/online-courses/${id}` },
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("title, description, subject, teacher:teachers(name)")
    .eq("is_online_only", true)
    .eq("is_active", true)
    .eq("id", id)
    .single()
    .overrideTypes<CourseSchemaResult | null, { merge: false }>();

  return (
    <>
      {course ? (
        <>
          <BreadcrumbJsonLd
            items={[
              { name: "Home", path: "/" },
              { name: "Online Courses", path: "/online-courses" },
              { name: course.title, path: `/online-courses/${id}` },
            ]}
          />
          <CourseJsonLd
            name={course.title}
            description={course.description || `Learn ${course.subject} with expert faculty at STC Academy.`}
            url={`/online-courses/${id}`}
            providerName={(Array.isArray(course.teacher) ? course.teacher[0] : course.teacher)?.name}
          />
        </>
      ) : null}
      <CourseDetailClient courseId={id} />
    </>
  );
}
