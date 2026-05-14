import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCheckoutMessage } from "@/lib/whatsapp";

/**
 * Minimum duration (in minutes) between check-in and check-out.
 * Mirrors the constant in the lookup endpoint.
 */
const MIN_CHECKOUT_DURATION_MINUTES = 30;

// Utility functions moved to module scope for better performance
const getTodayInIndia = (): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
};

const extractStudentProfile = (student: any) => {
  const profileArr = student.profile as unknown as Array<{
    full_name: string;
    phone: string;
    parent_phone: string | null;
    avatar_url: string | null;
  }> | null;

  return profileArr?.[0] ?? null;
};

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
        { error: "Only teachers and admins can confirm attendance" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Input validation with early returns
    const body = (await request.json()) as {
      studentId?: string;
      action?: string;
    };
    const studentId = body.studentId?.trim();
    const action = body.action?.trim();

    if (!studentId || !action) {
      return NextResponse.json(
        { error: "Missing studentId or action" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const validActions = new Set(["check-in", "check-out"]);
    if (!validActions.has(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be check-in or check-out." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Basic input format validation
    if (studentId.length < 10) {
      return NextResponse.json(
        { error: "Invalid studentId format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Single admin client instance for all operations
    const admin = createAdminClient();

    // Verify student exists and is active with optimized query
    const { data: student, error: studentError } = await admin
      .from("students")
      .select(
        "id, class_id, profile:profiles(full_name, phone, parent_phone, avatar_url)",
      )
      .eq("id", studentId)
      .eq("is_active", true)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Student not found or inactive" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Extract student information efficiently
    const studentProfile = extractStudentProfile(student);
    const studentName = studentProfile?.full_name ?? "Unknown Student";
    const studentPhoto = studentProfile?.avatar_url ?? null;
    const classId = student.class_id as string;

    // Optimize date calculations
    const today = getTodayInIndia();
    const now = new Date().toISOString();

    // Teacher access validation (if needed)
    if (profile.role === "teacher") {
      const { data: access, error: accessError } = await admin
        .from("teacher_class_access")
        .select("class_id")
        .eq("teacher_profile_id", user.id)
        .eq("class_id", classId)
        .maybeSingle();

      if (accessError || !access) {
        return NextResponse.json(
          { error: "You do not have access to this student's class" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Re-check attendance state (prevent race conditions)
    const { data: existing, error: existingError } = await admin
      .from("attendance")
      .select("id, check_in_at, check_out_at, status")
      .eq("student_id", studentId)
      .eq("date", today)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to check attendance state" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Execute check-in action
    if (action === "check-in") {
      if (existing?.check_in_at) {
        // Already checked in — return current state
        return NextResponse.json(
          {
            action: "already-checked-in",
            studentName,
            studentPhoto,
            checkInAt: existing.check_in_at,
            checkOutAt: existing.check_out_at,
            message: `${studentName} is already checked in today`,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      if (existing) {
        // Manual attendance exists but no check_in_at — update it
        const { error: patchError } = await admin
          .from("attendance")
          .update({ check_in_at: now, scan_method: "qr", marked_by: user.id })
          .eq("id", existing.id);

        if (patchError) {
          console.error("[QR Confirm] Patch error:", patchError);
          return NextResponse.json(
            { error: "Failed to record check-in" },
            { status: 500, headers: { "Cache-Control": "no-store" } }
          );
        }

        return NextResponse.json(
          {
            action: "check-in",
            studentName,
            studentPhoto,
            checkInAt: now,
            checkOutAt: null,
            message: `${studentName} checked in (manual record updated)`,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      // Create new attendance record
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
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      return NextResponse.json(
        {
          action: "check-in",
          studentName,
          studentPhoto,
          checkInAt: now,
          checkOutAt: null,
          message: `${studentName} checked in successfully`,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Execute check-out action
    if (!existing?.check_in_at) {
      return NextResponse.json(
        { error: `${studentName} has not checked in today` },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (existing.check_out_at) {
      return NextResponse.json(
        {
          action: "already-completed",
          studentName,
          studentPhoto,
          checkInAt: existing.check_in_at,
          checkOutAt: existing.check_out_at,
          message: `${studentName} has already checked out today`,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Minimum duration validation
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
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Perform check-out update
    const { error: updateError } = await admin
      .from("attendance")
      .update({ check_out_at: now, marked_by: user.id })
      .eq("id", existing.id);

    if (updateError) {
      console.error("[QR Confirm] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to record check-out" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Send WhatsApp notification asynchronously (fire-and-forget)
    const parentPhone = studentProfile?.parent_phone || studentProfile?.phone || "";
    if (parentPhone) {
      sendCheckoutMessage(
        parentPhone,
        studentName,
        existing.check_in_at as string,
        now,
      )
        .then(async (result) => {
          try {
            await admin.from("notifications").insert({
              student_id: studentId,
              type: "checkout",
              message: `Check-out WhatsApp sent to ${parentPhone}`,
              channel: "whatsapp",
              delivery_type: "whatsapp",
              status: result.success ? "sent" : "failed",
              sent_at: result.success ? new Date().toISOString() : null,
            });
          } catch (notificationError) {
            console.error("[QR Confirm] Notification insert error:", notificationError);
          }
        })
        .catch((err) => {
          console.error("[WhatsApp] Notification error:", err);
        });
    }

    return NextResponse.json(
      {
        action: "check-out",
        studentName,
        studentPhoto,
        checkInAt: existing.check_in_at,
        checkOutAt: now,
        message: `${studentName} checked out successfully`,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[QR Confirm] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
