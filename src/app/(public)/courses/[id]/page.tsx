import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { CourseDetailClient } from "./client";

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
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
    .single();

  if (!course) {
    return {
      title: "Course Not Found - STC Academy",
      description: "The requested course could not be found.",
    };
  }

  const classData = course.class as { name: string; board: string } | { name: string; board: string }[] | null;
  const cls = Array.isArray(classData) ? classData[0] : classData;

  return {
    title: `${course.title} - ${course.subject} | STC Academy`,
    description: course.description || `Learn ${course.subject} with expert faculty at STC Academy. ${cls?.board || "STC"} curriculum for ${cls?.name || "students"}.`,
    keywords: [course.subject, course.title, cls?.board || "STC", cls?.name || "", "online course", "STC Academy"],
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;

  return <CourseDetailClient courseId={id} />;
}
