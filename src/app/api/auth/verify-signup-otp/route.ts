import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  SIGNUP_OTP_COOKIE,
  decryptPendingSignup,
  getSignupOtpCookieOptions,
  isOtpExpired,
  otpMatches,
} from "@/lib/auth/signup-otp";

export async function POST(request: NextRequest) {
  try {
    const { otp } = await request.json();
    const normalizedOtp = String(otp ?? "").trim();

    if (!normalizedOtp) {
      return NextResponse.json(
        { error: "OTP is required." },
        { status: 400 },
      );
    }

    const pendingToken = request.cookies.get(SIGNUP_OTP_COOKIE)?.value;

    if (!pendingToken) {
      return NextResponse.json(
        { error: "Signup session expired. Please request a new OTP." },
        { status: 400 },
      );
    }

    const pendingSignup = decryptPendingSignup(pendingToken);

    if (!pendingSignup || isOtpExpired(pendingSignup.expiresAt)) {
      const response = NextResponse.json(
        { error: "Signup session expired. Please request a new OTP." },
        { status: 400 },
      );
      response.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));
      return response;
    }

    if (!otpMatches(pendingSignup.otp, normalizedOtp)) {
      return NextResponse.json(
        { error: "Invalid OTP. Please check the code and try again." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfigured for signup verification." },
        { status: 500 },
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: pendingSignup.email,
        password: pendingSignup.password,
        email_confirm: true,
        user_metadata: {
          full_name: pendingSignup.fullName,
          phone: pendingSignup.phone,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Failed to create account." },
        { status: 400 },
      );
    }

    await admin.from("profiles").upsert({
      id: authData.user.id,
      full_name: pendingSignup.fullName,
      phone: pendingSignup.phone,
      role: "student",
    });

    const response = NextResponse.json({
      success: true,
      email: pendingSignup.email,
      password: pendingSignup.password,
    });
    response.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify signup OTP";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
