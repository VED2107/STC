import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

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

    const [courseRes, profileRes] = await Promise.all([
      supabase
        .from("courses")
        .select("id, title, class_id, fee_inr, is_active")
        .eq("id", courseId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (courseRes.error || !courseRes.data || !courseRes.data.is_active) {
      return NextResponse.json({ error: "Course is not available for purchase" }, { status: 404 });
    }
    if (!profileRes.data || profileRes.data.role !== "student") {
      return NextResponse.json({ error: "Only students can purchase courses" }, { status: 403 });
    }

    const feeInr = Math.max(0, Number(courseRes.data.fee_inr ?? 0));
    if (feeInr <= 0) {
      return NextResponse.json({ error: "This course is free. Use free enrollment." }, { status: 400 });
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json({ error: "Razorpay keys are missing on server" }, { status: 500 });
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
          { status: 500 },
        );
      }
      studentId = createdStudent.id;
    } else {
      if (existingStudent.student_type === "tuition") {
        return NextResponse.json(
          { error: "Tuition students already get access from admin class assignment." },
          { status: 400 },
        );
      }
      if (!existingStudent.is_active || existingStudent.class_id !== courseRes.data.class_id) {
        const { error: activateError } = await admin
          .from("students")
          .update({ is_active: true, class_id: courseRes.data.class_id })
          .eq("id", existingStudent.id);
        if (activateError) {
          return NextResponse.json({ error: activateError.message }, { status: 500 });
        }
      }
      studentId = existingStudent.id;
    }

    const amountInPaise = feeInr * 100;
    const receipt = `stc_${courseRes.data.id.slice(0, 8)}_${Date.now()}`;
    const authHeader = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

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
      return NextResponse.json({ error: description }, { status: 500 });
    }

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
      return NextResponse.json({ error: paymentInsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orderId: orderData.id,
      amountInPaise,
      currency: "INR",
      keyId: razorpayKeyId,
      courseTitle: courseRes.data.title,
      studentName: profileRes.data.full_name || user.email || "Student",
      studentEmail: user.email || "",
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "Failed to start Razorpay checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
