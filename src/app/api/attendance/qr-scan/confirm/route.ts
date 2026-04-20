import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCheckoutMessage } from "@/lib/whatsapp";

/**
 * Minimum duration (in minutes) between check-in and check-out.
 * Mirrors the constant in the lookup endpoint.
 */
const MIN_CHECKOUT_DURATION_MINUTES = 30;

/**
 * POST /api/attendance/qr-scan/confirm
 *
 * Commit endpoint — writes the attendance record after teacher confirmation.
 * Re-validates everything server-side before writing.
 *
 * Body: { studentId: string, action: "check-in" | "check-out" }
 * Auth: teacher or admin
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
        { error: "Only teachers and admins can confirm attendance" },
        { status: 403 },
      );
    }

    // 2. Parse body
    const body = (await request.json()) as {
      studentId?: string;
      action?: string;
    };
    const studentId = body.studentId?.trim();
    const action = body.action?.trim();

    if (!studentId || !action) {
      return NextResponse.json(
        { error: "Missing studentId or action" },
        { status: 400 },
      );
    }

    if (action !== "check-in" && action !== "check-out") {
      return NextResponse.json(
        { error: "Invalid action. Must be check-in or check-out." },
        { status: 400 },
      );
    }

    // 3. Admin client for DB writes
    const admin = createAdminClient();

    // 4. Verify student exists and is active
    const { data: student } = await admin
      .from("students")
      .select(
        "id, class_id, profile:profiles(full_name, phone, parent_phone, avatar_url)",
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

    const studentName = studentProfile?.full_name ?? "Unknown Student";
    const studentPhoto = studentProfile?.avatar_url ?? null;
    const classId = student.class_id as string;
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const now = new Date().toISOString();

    if (profile.role === "teacher") {
      const { data: access } = await admin
        .from("teacher_class_access")
        .select("class_id")
        .eq("teacher_profile_id", user.id)
        .eq("class_id", classId)
        .maybeSingle();

      if (!access) {
        return NextResponse.json(
          { error: "You do not have access to this student's class" },
          { status: 403 },
        );
      }
    }

    // 5. Re-check attendance state (prevent race conditions)
    const { data: existing } = await admin
      .from("attendance")
      .select("id, check_in_at, check_out_at, status")
      .eq("student_id", studentId)
      .eq("date", today)
      .single();

    // 6. Execute the action
    if (action === "check-in") {
      if (existing && existing.check_in_at) {
        // Already checked in — don't overwrite
        return NextResponse.json({
          action: "already-checked-in",
          studentName,
          studentPhoto,
          checkInAt: existing.check_in_at,
          checkOutAt: existing.check_out_at,
          message: `${studentName} is already checked in today`,
        });
      }

      if (existing) {
        // Manual attendance exists but no check_in_at — patch it
        const { error: patchError } = await admin
          .from("attendance")
          .update({ check_in_at: now, scan_method: "qr", marked_by: user.id })
          .eq("id", existing.id);

        if (patchError) {
          console.error("[QR Confirm] Patch error:", patchError);
          return NextResponse.json(
            { error: "Failed to record check-in" },
            { status: 500 },
          );
        }

        return NextResponse.json({
          action: "check-in",
          studentName,
          studentPhoto,
          checkInAt: now,
          checkOutAt: null,
          message: `${studentName} checked in (manual record updated)`,
        });
      }

      // Create new attendance row
      const { error: insertError } = await admin.from("attendance").insert({
        student_id: studentId,
        class_id: classId,
        date: today,
        status: "present",
        check_in_at: now,
        scan_method: "qr",
        marked_by: user.id,
      });

      if (insertError) {
        console.error("[QR Confirm] Insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to record check-in" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        action: "check-in",
        studentName,
        studentPhoto,
        checkInAt: now,
        checkOutAt: null,
        message: `${studentName} checked in successfully`,
      });
    }

    // action === "check-out"
    if (!existing || !existing.check_in_at) {
      return NextResponse.json(
        { error: `${studentName} has not checked in today` },
        { status: 400 },
      );
    }

    if (existing.check_out_at) {
      return NextResponse.json({
        action: "already-completed",
        studentName,
        studentPhoto,
        checkInAt: existing.check_in_at,
        checkOutAt: existing.check_out_at,
        message: `${studentName} has already checked out today`,
      });
    }

    // Minimum duration re-validation
    const checkInTime = new Date(existing.check_in_at as string).getTime();
    const elapsedMinutes = (Date.now() - checkInTime) / 60000;

    if (elapsedMinutes < MIN_CHECKOUT_DURATION_MINUTES) {
      const remainingMinutes = Math.ceil(
        MIN_CHECKOUT_DURATION_MINUTES - elapsedMinutes,
      );
      return NextResponse.json(
        {
          error: `Too early to check out. ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""} remaining.`,
          action: "too-early",
          remainingMinutes,
        },
        { status: 400 },
      );
    }

    // Perform check-out
      const { error: updateError } = await admin
      .from("attendance")
      .update({ check_out_at: now, marked_by: user.id })
      .eq("id", existing.id);

    if (updateError) {
      console.error("[QR Confirm] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to record check-out" },
        { status: 500 },
      );
    }

    // Send WhatsApp notification (fire-and-forget)
    const parentPhone =
      studentProfile?.parent_phone || studentProfile?.phone || "";
    if (parentPhone) {
      sendCheckoutMessage(
        parentPhone,
        studentName,
        existing.check_in_at as string,
        now,
      )
        .then(async (result) => {
          await admin.from("notifications").insert({
            student_id: studentId,
            type: "checkout",
            message: `Check-out WhatsApp sent to ${parentPhone}`,
            channel: "whatsapp",
            delivery_type: "whatsapp",
            status: result.success ? "sent" : "failed",
            sent_at: result.success ? new Date().toISOString() : null,
          });
        })
        .catch((err) => {
          console.error("[WhatsApp] Notification error:", err);
        });
    }

    return NextResponse.json({
      action: "check-out",
      studentName,
      studentPhoto,
      checkInAt: existing.check_in_at,
      checkOutAt: now,
      message: `${studentName} checked out successfully`,
    });
  } catch (err) {
    console.error("[QR Confirm] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
