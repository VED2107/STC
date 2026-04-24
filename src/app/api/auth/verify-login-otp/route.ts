import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  LOGIN_OTP_COOKIE,
  decryptPendingLogin,
  getLoginOtpCookieOptions,
  isLoginOtpExpired,
} from "@/lib/auth/login-otp";

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

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return NextResponse.json(
        { error: "OTP must be exactly 6 digits." },
        { status: 400 },
      );
    }

    const pendingToken = request.cookies.get(LOGIN_OTP_COOKIE)?.value;

    if (!pendingToken) {
      return NextResponse.json(
        { error: "Login session expired. Please request a new code." },
        { status: 400 },
      );
    }

    const pendingLogin = decryptPendingLogin(pendingToken);

    if (!pendingLogin || isLoginOtpExpired(pendingLogin.expiresAt)) {
      const response = NextResponse.json(
        { error: "Login session expired. Please request a new code." },
        { status: 400 },
      );
      response.cookies.set(LOGIN_OTP_COOKIE, "", getLoginOtpCookieOptions(0));
      return response;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfigured for OTP verification." },
        { status: 500 },
      );
    }

    let response = NextResponse.json({
      success: true,
      email: pendingLogin.email,
    });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.json({
            success: true,
            email: pendingLogin.email,
          });
          response.cookies.set(LOGIN_OTP_COOKIE, "", getLoginOtpCookieOptions(0));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

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

    const firstError =
      attempts.find(({ error }) => error)?.error?.message ??
      "Invalid login code. Please try again.";

    if (!successfulAttempt) {
      return NextResponse.json(
        { error: firstError },
        { status: 400 },
      );
    }

    response.cookies.set(LOGIN_OTP_COOKIE, "", getLoginOtpCookieOptions(0));
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify login OTP";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
