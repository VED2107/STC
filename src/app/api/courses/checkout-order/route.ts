import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

// Environment validation at module scope for better performance
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

export async function POST(request: Request) {
  try {
    // Early environment validation
    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        { error: "Razorpay keys are missing on server" },
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

    // Parallel course and profile queries
    const [courseRes, profileRes] = await Promise.all([
      supabase
        .from("courses")
        .select("id, title, class_id, fee_inr, is_active, is_online_only")
        .eq("id", courseId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    // Course validation
    if (courseRes.error || !courseRes.data) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!courseRes.data.is_active || !courseRes.data.is_online_only) {
      return NextResponse.json(
        { error: "Course is not available for purchase" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Profile validation
    if (profileRes.error || !profileRes.data) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (profileRes.data.role !== "student") {
      return NextResponse.json(
        { error: "Only students can purchase courses" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Fee validation
    const feeInr = Math.max(0, Number(courseRes.data.fee_inr ?? 0));
    if (feeInr <= 0) {
      return NextResponse.json(
        { error: "This course is free. Use free enrollment." },
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
          class_id: courseRes.data.class_id,
          student_type: "online",
          is_active: true,
          enrollment_date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (createStudentError || !createdStudent) {
        return NextResponse.json(
          { error: createStudentError?.message ?? "Could not create online student profile" },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      studentId = createdStudent.id;
    } else {
      // Validate existing student
      if (existingStudent.student_type === "tuition") {
        return NextResponse.json(
          { error: "Tuition students already get access from admin class assignment." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      // Update student if needed
      if (!existingStudent.is_active || existingStudent.class_id !== courseRes.data.class_id) {
        const { error: activateError } = await admin
          .from("students")
          .update({ is_active: true, class_id: courseRes.data.class_id })
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

    // Prepare Razorpay order data
    const amountInPaise = feeInr * 100;
    const receipt = `stc_${courseRes.data.id.slice(0, 8)}_${Date.now()}`;
    const authHeader = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    // Create Razorpay order
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          course_id: courseRes.data.id,
          student_id: studentId,
        },
      }),
    });

    const orderData = (await razorpayResponse.json()) as RazorpayOrderResponse & { error?: { description?: string } };

    if (!razorpayResponse.ok || !orderData.id) {
      const description = orderData?.error?.description ?? "Could not create Razorpay order";
      return NextResponse.json(
        { error: description },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Insert payment record
    const { error: paymentInsertError } = await admin.from("course_payments").insert({
      student_id: studentId,
      course_id: courseRes.data.id,
      gateway: "razorpay",
      currency: "INR",
      amount_inr: feeInr,
      status: "created",
      gateway_order_id: orderData.id,
      meta: {
        receipt,
        razorpay_status: orderData.status,
      },
    });

    if (paymentInsertError) {
      return NextResponse.json(
        { error: paymentInsertError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Return checkout data
    return NextResponse.json(
      {
        success: true,
        orderId: orderData.id,
        amountInPaise,
        currency: "INR",
        keyId: razorpayKeyId,
        courseTitle: courseRes.data.title,
        studentName: profileRes.data.full_name || user.email || "Student",
        studentEmail: user.email || "",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start Razorpay checkout";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
