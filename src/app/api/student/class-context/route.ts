import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, class_id, student_type")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (studentError) {
      return NextResponse.json({ error: studentError.message }, { status: 500 });
    }

    if (!student) {
      return NextResponse.json({ student: null, class: null, courses: [] });
    }

    let resolvedClass = null as {
      id: string;
      name: string;
      board: string;
      level: string;
    } | null;

    if (student.class_id) {
      const { data: classData } = await admin
        .from("classes")
        .select("id, name, board, level")
        .eq("id", student.class_id)
        .maybeSingle();

      resolvedClass =
        (classData as { id: string; name: string; board: string; level: string } | null) ?? null;
    }

    const { data: enrollmentRows, error: enrollmentError } = await admin
      .from("enrollments")
      .select("course:courses(id, title, subject, class_id)")
      .eq("student_id", student.id)
      .eq("status", "active");

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    }

    const courses =
      ((enrollmentRows as Array<{
        course: { id: string; title: string; subject: string; class_id?: string | null } | null;
      }> | null) ?? [])
        .map((entry) => entry.course)
        .filter(
          (
            entry,
          ): entry is { id: string; title: string; subject: string; class_id?: string | null } =>
            Boolean(entry),
        );

    if (!resolvedClass) {
      const fallbackClassId = courses.find((entry) => entry.class_id)?.class_id ?? null;

      if (fallbackClassId) {
        const { data: fallbackClass } = await admin
          .from("classes")
          .select("id, name, board, level")
          .eq("id", fallbackClassId)
          .maybeSingle();

        resolvedClass =
          (fallbackClass as { id: string; name: string; board: string; level: string } | null) ?? null;
      }
    }

    return NextResponse.json({
      student: {
        id: student.id,
        class_id: student.class_id,
        student_type: student.student_type,
      },
      class: resolvedClass,
      courses,
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "Failed to load class context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
