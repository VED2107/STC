import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Environment validation at module scope
const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

export async function POST(request: Request) {
  try {
    // Early environment validation
    if (!razorpaySecret) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

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
      return NextResponse.json(
        { error: "Missing payment verification payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Basic format validation
    if (courseId.length < 10 || orderId.length < 10 || paymentId.length < 10) {
      return NextResponse.json(
        { error: "Invalid payment data format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Signature verification
    const expectedBuffer = Buffer.from(
      createHmac("sha256", razorpaySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex"),
    );
    const signatureBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Single admin client instance
    const admin = createAdminClient();

    // Verify student and payment in parallel
    const [{ data: student }, { data: paymentRow, error: paymentLookupError }] = await Promise.all([
      admin
        .from("students")
        .select("id, student_type")
        .eq("profile_id", user.id)
        .maybeSingle(),
      admin
        .from("course_payments")
        .select("id, student_id, course_id, status, course:courses(class_id)")
        .eq("gateway_order_id", orderId)
        .eq("course_id", courseId)
        .maybeSingle(),
    ]);

    if (!student || student.student_type !== "online") {
      return NextResponse.json(
        { error: "Only online students can verify this payment" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (paymentLookupError || !paymentRow || paymentRow.student_id !== student.id) {
      return NextResponse.json(
        { error: "Payment order record not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Process enrollment and student updates in parallel
    const purchasedClassId =
      (paymentRow.course as { class_id?: string } | null)?.class_id ?? null;

    const updatePromises: Array<Promise<{ error: { message: string } | null }>> = [
      (async () => {
        const { error } = await admin.from("enrollments").upsert(
          {
            student_id: student.id,
            course_id: courseId,
            status: "active",
          },
          { onConflict: "student_id,course_id" },
        );
        return { error };
      })(),
      (async () => {
        const { error } = await admin
          .from("course_payments")
          .update({
            status: "captured",
            gateway_payment_id: paymentId,
            gateway_signature: signature,
            paid_at: new Date().toISOString(),
          })
          .eq("id", paymentRow.id);
        return { error };
      })(),
    ];

    if (purchasedClassId) {
      updatePromises.push(
        (async () => {
          const { error } = await admin
            .from("students")
            .update({ class_id: purchasedClassId, is_active: true })
            .eq("id", student.id);
          return { error };
        })()
      );
    }

    const results = await Promise.all(updatePromises);
    const firstError = results.find((result) => result.error)?.error;

    if (firstError) {
      return NextResponse.json(
        { error: firstError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
