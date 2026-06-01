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
      .select("id, class_id, branch_id, student_type")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (studentError) {
      return NextResponse.json({ error: studentError.message }, { status: 500 });
    }

    if (!student) {
      return NextResponse.json({ student: null, class: null, branch: null, courses: [] });
    }

    const typedStudent = student as { id: string; class_id: string | null; branch_id: string | null; student_type: string };

    // Parallel fetch: branch, class, and enrollments all at once
    const [branchResult, classResult, enrollmentResult] = await Promise.all([
      typedStudent.branch_id
        ? admin
            .from("branches")
            .select("id, name")
            .eq("id", typedStudent.branch_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      typedStudent.class_id
        ? admin
            .from("classes")
            .select("id, name, board, level")
            .eq("id", typedStudent.class_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("enrollments")
        .select("course:courses(id, title, subject, class_id)")
        .eq("student_id", typedStudent.id)
        .eq("status", "active"),
    ]);

    const resolvedBranch = (branchResult.data as { id: string; name: string } | null) ?? null;
    let resolvedClass =
      (classResult.data as { id: string; name: string; board: string; level: string } | null) ?? null;

    if (enrollmentResult.error) {
      return NextResponse.json({ error: enrollmentResult.error.message }, { status: 500 });
    }

    const courses =
      ((enrollmentResult.data as unknown as Array<{
        course: { id: string; title: string; subject: string; class_id?: string | null } | null;
      }>) ?? [])
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
        id: typedStudent.id,
        class_id: typedStudent.class_id,
        branch_id: typedStudent.branch_id,
        student_type: typedStudent.student_type,
      },
      class: resolvedClass,
      branch: resolvedBranch,
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
