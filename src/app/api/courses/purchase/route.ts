import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // Early auth validation
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Input validation with early returns
    const body = (await request.json()) as { courseId?: string };
    const courseId = body?.courseId?.trim();

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Basic courseId format validation
    if (courseId.length < 10) {
      return NextResponse.json(
        { error: "Invalid course ID format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Profile validation
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (profile.role !== "student") {
      return NextResponse.json(
        { error: "Only students can purchase courses" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Course validation
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, class_id, is_active, fee_inr, is_online_only")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!course.is_active || !course.is_online_only) {
      return NextResponse.json(
        { error: "Course is not available for purchase" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (Number(course.fee_inr ?? 0) > 0) {
      return NextResponse.json(
        { error: "Paid course requires Razorpay checkout. Use checkout-order flow." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Single admin client instance for all operations
    const admin = createAdminClient();

    // Check for existing student profile
    const { data: existingStudent, error: studentFetchError } = await admin
      .from("students")
      .select("id, student_type, class_id, is_active")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (studentFetchError) {
      return NextResponse.json(
        { error: studentFetchError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    let studentId: string;

    if (!existingStudent) {
      // Create new online student profile
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
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      studentId = createdStudent.id;
    } else {
      // Validate existing student
      if (existingStudent.student_type === "tuition") {
        return NextResponse.json(
          { error: "Tuition students already receive class resources without purchase." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      // Update student if needed
      if (!existingStudent.is_active || existingStudent.class_id !== course.class_id) {
        const { error: activateError } = await admin
          .from("students")
          .update({ is_active: true, class_id: course.class_id })
          .eq("id", existingStudent.id);

        if (activateError) {
          return NextResponse.json(
            { error: activateError.message },
            { status: 500, headers: { "Cache-Control": "no-store" } }
          );
        }
      }
      studentId = existingStudent.id;
    }

    // Create or update enrollment
    const { error: enrollmentError } = await admin.from("enrollments").upsert(
      {
        student_id: studentId,
        course_id: course.id,
        status: "active",
      },
      { onConflict: "student_id,course_id" },
    );

    if (enrollmentError) {
      return NextResponse.json(
        { error: enrollmentError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        classId: course.class_id,
        courseId: course.id
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete course purchase";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
