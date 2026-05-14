import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  LOGIN_OTP_COOKIE,
  decryptPendingLogin,
  getLoginOtpCookieOptions,
  isLoginOtpExpired,
} from "@/lib/auth/login-otp";

// Environment validation at module scope for better performance
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  const noStoreHeaders = { "Cache-Control": "no-store" } as const;

  try {
    // Early environment validation
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfigured for OTP verification." },
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
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return NextResponse.json(
        { error: "OTP must be exactly 6 digits." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // Cookie validation
    const pendingToken = request.cookies.get(LOGIN_OTP_COOKIE)?.value;
    if (!pendingToken) {
      return NextResponse.json(
        { error: "Login session expired. Please request a new code." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // Decrypt and validate pending login
    const pendingLogin = decryptPendingLogin(pendingToken);
    if (!pendingLogin || isLoginOtpExpired(pendingLogin.expiresAt)) {
      const response = NextResponse.json(
        { error: "Login session expired. Please request a new code." },
        { status: 400, headers: noStoreHeaders }
      );
      response.cookies.set(LOGIN_OTP_COOKIE, "", getLoginOtpCookieOptions(0));
      return response;
    }

    // Create response object once
    let response = NextResponse.json({
      success: true,
      email: pendingLogin.email,
    }, { headers: noStoreHeaders });

    // Initialize Supabase client with optimized cookie handling
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Clear login OTP cookie once
          response.cookies.set(LOGIN_OTP_COOKIE, "", getLoginOtpCookieOptions(0));

          // Set all auth cookies at once
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Verify OTP with parallel attempts for better performance
    const attempts = await Promise.all([
      supabase.auth.verifyOtp({
        email: pendingLogin.email,
        token: normalizedOtp,
        type: "email",
      }),
      supabase.auth.verifyOtp({
        email: pendingLogin.email,
        token: normalizedOtp,
        type: "magiclink",
      }),
    ]);

    const successfulAttempt = attempts.find(
      ({ data, error }) => !error && data.session && data.user,
    );

    if (!successfulAttempt) {
      const firstError =
        attempts.find(({ error }) => error)?.error?.message ??
        "Invalid login code. Please try again.";

      return NextResponse.json(
        { error: firstError },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // Ensure cleanup cookie is set
    response.cookies.set(LOGIN_OTP_COOKIE, "", getLoginOtpCookieOptions(0));
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify login OTP";

    return NextResponse.json(
      { error: message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
