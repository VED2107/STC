import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { courseId?: string };
    const courseId = body?.courseId?.trim();
    if (!courseId) {
      return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Only students can purchase courses" }, { status: 403 });
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, class_id, is_active, fee_inr, is_online_only")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError || !course || !course.is_active || !course.is_online_only) {
      return NextResponse.json({ error: "Course is not available for purchase" }, { status: 404 });
    }
    if (Number(course.fee_inr ?? 0) > 0) {
      return NextResponse.json(
        { error: "Paid course requires Razorpay checkout. Use checkout-order flow." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: existingStudent, error: studentFetchError } = await admin
      .from("students")
      .select("id, student_type, class_id, is_active")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (studentFetchError) {
      return NextResponse.json({ error: studentFetchError.message }, { status: 500 });
    }

    let studentId = existingStudent?.id ?? "";

    if (!existingStudent) {
      const { data: createdStudent, error: createStudentError } = await admin
        .from("students")
        .insert({
          profile_id: user.id,
          class_id: course.class_id,
          student_type: "online",
          enrollment_date: new Date().toISOString().split("T")[0],
          is_active: true,
        })
        .select("id")
        .single();

      if (createStudentError || !createdStudent) {
        return NextResponse.json(
          { error: createStudentError?.message ?? "Failed to create student access row" },
          { status: 500 },
        );
      }
      studentId = createdStudent.id;
    } else {
      if (existingStudent.student_type === "tuition") {
        return NextResponse.json(
          { error: "Tuition students already receive class resources without purchase." },
          { status: 400 },
        );
      }

      if (!existingStudent.is_active || existingStudent.class_id !== course.class_id) {
        // NOTE: This overwrites the student's class_id. If they had active
        // enrollments in a different class, those become orphaned. This is a
        // known limitation of the single class_id model for online students.
        const { error: activateError } = await admin
          .from("students")
          .update({ is_active: true, class_id: course.class_id })
          .eq("id", existingStudent.id);
        if (activateError) {
          return NextResponse.json({ error: activateError.message }, { status: 500 });
        }
      }

      studentId = existingStudent.id;
    }

    const { error: enrollmentError } = await admin.from("enrollments").upsert(
      {
        student_id: studentId,
        course_id: course.id,
        status: "active",
      },
      { onConflict: "student_id,course_id" },
    );

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, classId: course.class_id, courseId: course.id });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "Failed to complete course purchase";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
