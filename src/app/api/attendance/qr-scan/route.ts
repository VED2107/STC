import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Minimum duration (in minutes) between check-in and check-out.
 * Structured as a constant for easy future configuration.
 */
const MIN_CHECKOUT_DURATION_MINUTES = 30;

/**
 * POST /api/attendance/qr-scan
 *
 * Lookup-only endpoint — does NOT write to the database.
 * Returns student info + current attendance state + proposed action
 * so the teacher can verify before confirming.
 *
 * Body: { token: string }
 * Auth: teacher or admin (verified via Supabase session)
 *
 * Possible actions returned:
 *   - "check-in"          → No attendance record today, ready for check-in
 *   - "check-out"         → Checked in, ready for check-out
 *   - "already-completed" → Both check-in and check-out exist
 *   - "too-early"         → Check-in exists but minimum duration not met
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the scanner (teacher / admin)
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
        { error: "Only teachers and admins can scan QR codes" },
        { status: 403 },
      );
    }

    // 2. Parse & validate token
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "Missing QR token" }, { status: 400 });
    }

    // 3. Use admin client for cross-table lookups (bypasses RLS)
    const admin = createAdminClient();

    // Look up the token — if it doesn't exist, the old QR was regenerated
    const { data: qrToken, error: tokenError } = await admin
      .from("qr_tokens")
      .select("student_id, token, created_at")
      .eq("token", token)
      .single();

    if (tokenError || !qrToken) {
      return NextResponse.json(
        { error: "Invalid QR code. This code may have been regenerated." },
        { status: 404 },
      );
    }

    const studentId = qrToken.student_id as string;

    // 4. Get student details (name, class, photo, parent phone)
    const { data: student } = await admin
      .from("students")
      .select(
        "id, class_id, profile:profiles(full_name, phone, parent_phone, avatar_url), class:classes(name)",
      )
      .eq("id", studentId)
      .eq("is_active", true)
      .single();

    if (!student) {
      return NextResponse.json(
        { error: "Student not found or inactive" },
        { status: 404 },
      );
    }

    const profileArr = student.profile as unknown as Array<{
      full_name: string;
      phone: string;
      parent_phone: string | null;
      avatar_url: string | null;
    }> | null;
    const studentProfile = profileArr?.[0] ?? null;

    const classArr = student.class as unknown as Array<{
      name: string;
    }> | null;
    const classInfo = classArr?.[0] ?? null;

    const studentName = studentProfile?.full_name ?? "Unknown Student";
    const studentPhoto = studentProfile?.avatar_url ?? null;
    const className = classInfo?.name ?? "N/A";
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

    // 5. Check existing attendance for today
    const { data: existing } = await admin
      .from("attendance")
      .select("id, check_in_at, check_out_at, status")
      .eq("student_id", studentId)
      .eq("date", today)
      .single();

    // 6. Determine proposed action
    if (!existing) {
      // No record today → propose check-in
      return NextResponse.json({
        action: "check-in",
        studentId,
        studentName,
        studentPhoto,
        className,
        checkInAt: null,
        checkOutAt: null,
        message: `Ready to check in ${studentName}`,
      });
    }

    if (existing.check_out_at) {
      // Already completed → block
      return NextResponse.json({
        action: "already-completed",
        studentId,
        studentName,
        studentPhoto,
        className,
        checkInAt: existing.check_in_at,
        checkOutAt: existing.check_out_at,
        message: `${studentName} has already checked in and out today`,
      });
    }

    if (existing.check_in_at) {
      // Check minimum duration
      const checkInTime = new Date(existing.check_in_at as string).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - checkInTime) / 60000;

      if (elapsedMinutes < MIN_CHECKOUT_DURATION_MINUTES) {
        const remainingMinutes = Math.ceil(
          MIN_CHECKOUT_DURATION_MINUTES - elapsedMinutes,
        );
        return NextResponse.json({
          action: "too-early",
          studentId,
          studentName,
          studentPhoto,
          className,
          checkInAt: existing.check_in_at,
          checkOutAt: null,
          remainingMinutes,
          minDuration: MIN_CHECKOUT_DURATION_MINUTES,
          message: `Too early to check out. ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""} remaining.`,
        });
      }

      // Ready for check-out
      return NextResponse.json({
        action: "check-out",
        studentId,
        studentName,
        studentPhoto,
        className,
        checkInAt: existing.check_in_at,
        checkOutAt: null,
        message: `Ready to check out ${studentName}`,
      });
    }

    // Edge case: manual attendance exists but no check_in_at
    return NextResponse.json({
      action: "check-in",
      studentId,
      studentName,
      studentPhoto,
      className,
      checkInAt: null,
      checkOutAt: null,
      existingManual: true,
      message: `${studentName} has a manual record — ready to add QR check-in`,
    });
  } catch (err) {
    console.error("[QR Scan] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
