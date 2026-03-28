import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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

    const body = (await request.json()) as {
      courseId?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const courseId = body.courseId?.trim();
    const orderId = body.razorpay_order_id?.trim();
    const paymentId = body.razorpay_payment_id?.trim();
    const signature = body.razorpay_signature?.trim();

    if (!courseId || !orderId || !paymentId || !signature) {
      return NextResponse.json({ error: "Missing payment verification payload" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const expectedBuffer = Buffer.from(
      createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex"),
    );
    const signatureBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: student } = await admin
      .from("students")
      .select("id, student_type")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!student || student.student_type !== "online") {
      return NextResponse.json({ error: "Only online students can verify this payment" }, { status: 403 });
    }

    const { data: paymentRow, error: paymentLookupError } = await admin
      .from("course_payments")
      .select("id, student_id, course_id, status, course:courses(class_id)")
      .eq("gateway_order_id", orderId)
      .eq("course_id", courseId)
      .eq("student_id", student.id)
      .maybeSingle();

    if (paymentLookupError || !paymentRow) {
      return NextResponse.json({ error: "Payment order record not found" }, { status: 404 });
    }

    const { error: enrollmentError } = await admin.from("enrollments").upsert(
      {
        student_id: student.id,
        course_id: courseId,
        status: "active",
      },
      { onConflict: "student_id,course_id" },
    );

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    }

    const purchasedClassId =
      (paymentRow.course as { class_id?: string } | null)?.class_id ?? null;

    if (purchasedClassId) {
      const { error: classUpdateError } = await admin
        .from("students")
        .update({ class_id: purchasedClassId, is_active: true })
        .eq("id", student.id);

      if (classUpdateError) {
        return NextResponse.json({ error: classUpdateError.message }, { status: 500 });
      }
    }

    const { error: paymentUpdateError } = await admin
      .from("course_payments")
      .update({
        status: "captured",
        gateway_payment_id: paymentId,
        gateway_signature: signature,
        paid_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);

    if (paymentUpdateError) {
      return NextResponse.json({ error: paymentUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "Failed to verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
