import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import {
  SIGNUP_OTP_COOKIE,
  decryptPendingSignup,
  getSignupOtpCookieOptions,
  isOtpExpired,
  otpMatches,
} from "@/lib/auth/signup-otp";
import { ensureOnlineStudentAccess } from "@/lib/auth/self-signup";

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
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfigured for signup verification." },
        { status: 500 },
      );
    }

    const admin = createAdminClient();

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

    await ensureOnlineStudentAccess({
      userId: authData.user.id,
      fullName: pendingSignup.fullName,
      phone: pendingSignup.phone,
    });

    // Sign in server-side to establish session cookies without exposing
    // the password in the response body.
    let response = NextResponse.json({
      success: true,
      email: pendingSignup.email,
    });
    response.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.json({
            success: true,
            email: pendingSignup.email,
          });
          response.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: pendingSignup.email,
      password: pendingSignup.password,
    });

    if (signInError) {
      // Account was created but auto sign-in failed; the user can still
      // sign in manually from the login page.
      const fallbackResponse = NextResponse.json({
        success: true,
        email: pendingSignup.email,
        autoSignIn: false,
      });
      fallbackResponse.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));
      return fallbackResponse;
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify signup OTP";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
