import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

// Environment validation at module scope for better performance
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    // Early environment validation
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfigured for signup verification." },
        { status: 500 },
      );
    }

    // Input validation first
    const body = await request.json();
    const { otp } = body;
    const normalizedOtp = String(otp ?? "").trim();

    if (!normalizedOtp) {
      return NextResponse.json(
        { error: "OTP is required." },
        { status: 400 },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return NextResponse.json(
        { error: "OTP must be exactly 6 digits." },
        { status: 400 },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Cookie validation
    const pendingToken = request.cookies.get(SIGNUP_OTP_COOKIE)?.value;
    if (!pendingToken) {
      return NextResponse.json(
        { error: "Signup session expired. Please request a new OTP." },
        { status: 400 },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Decrypt and validate pending signup
    const pendingSignup = decryptPendingSignup(pendingToken);
    if (!pendingSignup || isOtpExpired(pendingSignup.expiresAt)) {
      const response = NextResponse.json(
        { error: "Signup session expired. Please request a new OTP." },
        { status: 400 },
        { headers: { "Cache-Control": "no-store" } }
      );
      response.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));
      return response;
    }

    // OTP validation
    if (!otpMatches(pendingSignup.otp, normalizedOtp)) {
      return NextResponse.json(
        { error: "Invalid OTP. Please check the code and try again." },
        { status: 400 },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Single admin client instance for user creation
    const admin = createAdminClient();

    // Create user account
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
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
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Ensure student access
    await ensureOnlineStudentAccess({
      userId: authData.user.id,
      fullName: pendingSignup.fullName,
      phone: pendingSignup.phone,
      email: pendingSignup.email,
    });

    // Create response object once
    let response = NextResponse.json({
      success: true,
      email: pendingSignup.email,
    }, { headers: { "Cache-Control": "no-store" } });

    // Initialize Supabase client with optimized cookie handling
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Clear signup OTP cookie once
          response.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));

          // Set all auth cookies at once
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Attempt automatic sign-in
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
      }, { headers: { "Cache-Control": "no-store" } });

      fallbackResponse.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));
      return fallbackResponse;
    }

    // Ensure cleanup cookie is set
    response.cookies.set(SIGNUP_OTP_COOKIE, "", getSignupOtpCookieOptions(0));
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify signup OTP";

    return NextResponse.json(
      { error: message },
      { status: 500 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
