import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
      return NextResponse.json(
        { error: "Only teachers and admins can scan attendance" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      token?: string;
      sessionId?: string;
    };

    const token = body.token?.trim();
    const sessionId = body.sessionId?.trim();

    if (!token || !sessionId) {
      return NextResponse.json(
        { error: "Missing token or sessionId" },
        { status: 400 },
      );
    }

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

      return NextResponse.json({ error: message }, { status: statusCode });
    }

    const row = ((data as MarkAttendanceRpcRow[] | null) ?? [])[0];

    if (!row) {
      return NextResponse.json(
        { error: "Attendance could not be recorded" },
        { status: 500 },
      );
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("[QR Scan] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
