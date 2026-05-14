import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTeacherSubjectAccessKey } from "@/lib/teacher-subject-access";
import { sendCheckInMessage, sendCheckoutMessage } from "@/lib/whatsapp";

interface MarkAttendanceRpcRow {
  status: "checked_in" | "checked_out" | "already_done";
  attendance_id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  subject: string;
  session_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    // Early auth validation
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Get user profile with error handling
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const allowedRoles = new Set(["teacher", "admin", "super_admin"]);
    if (!allowedRoles.has(profile.role)) {
      return NextResponse.json(
        { error: "Only teachers and admins can scan attendance" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Input validation with early returns
    const body = (await request.json()) as {
      token?: string;
      sessionId?: string;
    };

    const token = body.token?.trim();
    const sessionId = body.sessionId?.trim();

    if (!token || !sessionId) {
      return NextResponse.json(
        { error: "Missing token or sessionId" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Basic input format validation
    if (token.length < 10 || sessionId.length < 10) {
      return NextResponse.json(
        { error: "Invalid token or sessionId format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Teacher validation (if needed)
    if (profile.role === "teacher") {
      const admin = createAdminClient();
      const [{ data: session }, { data: subjectAccessRows }] = await Promise.all([
        admin
          .from("attendance_sessions")
          .select("id, class_id, subject, course_id")
          .eq("id", sessionId)
          .maybeSingle(),
        admin
          .from("teacher_subject_access")
          .select("class_id, subject")
          .eq("teacher_profile_id", user.id),
      ]);

      if (!session || !(session as { course_id: string | null }).course_id) {
        return NextResponse.json(
          { error: "Teachers can scan only assigned subject sessions" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }

      // Build subject access lookup for efficient validation
      const allowedSubjectKeys = new Set(
        ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
          buildTeacherSubjectAccessKey(row.class_id, row.subject),
        ),
      );

      const sessionKey = buildTeacherSubjectAccessKey(
        (session as { class_id: string }).class_id,
        (session as { subject: string }).subject
      );

      if (!allowedSubjectKeys.has(sessionKey)) {
        return NextResponse.json(
          { error: "You do not have access to this subject session" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Mark attendance using RPC
    const { data, error } = await supabase.rpc("mark_attendance", {
      p_student_token: token,
      p_session_id: sessionId,
      p_teacher_id: user.id,
    });

    if (error) {
      const message = error.message || "Failed to mark attendance";
      const statusCode =
        message.includes("Unauthorized") || message.includes("Only teachers")
          ? 403
          : message.includes("not found") || message.includes("Invalid")
            ? 404
            : 400;

      return NextResponse.json(
        { error: message },
        { status: statusCode, headers: { "Cache-Control": "no-store" } }
      );
    }

    const row = ((data as MarkAttendanceRpcRow[] | null) ?? [])[0];
    if (!row) {
      return NextResponse.json(
        { error: "Attendance could not be recorded" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Handle WhatsApp notifications for check-in/check-out
    const shouldSendNotification = row.status === "checked_in" || row.status === "checked_out";
    if (shouldSendNotification) {
      // Use admin client for student data lookup
      const admin = createAdminClient();
      const { data: student } = await admin
        .from("students")
        .select("id, profile:profiles(phone, parent_phone)")
        .eq("id", row.student_id)
        .maybeSingle();

      const studentProfile = (student?.profile as
        | Array<{ phone: string | null; parent_phone: string | null }>
        | null)?.[0];
      const parentPhone = studentProfile?.parent_phone || studentProfile?.phone || "";

      // Determine notification type
      const canSendCheckIn = row.status === "checked_in" && Boolean(row.check_in_at);
      const canSendCheckOut =
        row.status === "checked_out" &&
        Boolean(row.check_in_at) &&
        Boolean(row.check_out_at);

      // Send WhatsApp notification asynchronously
      if (parentPhone && (canSendCheckIn || canSendCheckOut)) {
        const sendPromise = canSendCheckIn
          ? sendCheckInMessage(parentPhone, row.student_name, row.check_in_at as string)
          : sendCheckoutMessage(
              parentPhone,
              row.student_name,
              row.check_in_at as string,
              row.check_out_at as string,
            );

        // Fire and forget - don't block the response
        void sendPromise.catch((sendError) => {
          console.error("[QR Scan] Parent WhatsApp failed:", sendError);
        });
      }
    }

    // Return standardized response
    return NextResponse.json(
      {
        status: row.status,
        attendanceId: row.attendance_id,
        studentId: row.student_id,
        studentName: row.student_name,
        className: row.class_name,
        subject: row.subject,
        sessionDate: row.session_date,
        checkInAt: row.check_in_at,
        checkOutAt: row.check_out_at,
        message: row.message,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[QR Scan] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
