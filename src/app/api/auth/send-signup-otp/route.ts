import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  SIGNUP_OTP_COOKIE,
  OTP_EXPIRY_MINUTES,
  buildPendingSignup,
  encryptPendingSignup,
  getSignupOtpCookieOptions,
} from "@/lib/auth/signup-otp";
import {
  canBypassResendInDevelopment,
  getResendFromEmail,
  isResendTestingRestriction,
} from "@/lib/auth/resend";
import { buildStcEmailTemplate } from "@/lib/auth/email-theme";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function jsonNoStore(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function buildSignupOtpEmail({
  email,
  name,
  otp,
}: {
  email: string;
  name: string;
  otp: string;
}) {
  return buildStcEmailTemplate({
    eyebrow: "Pending Signup",
    title: "Check your email for the latest code",
    intro: `Hello ${name},`,
    description:
      "We sent a one-time verification code through our Resend mail flow. Use it to complete signup and unlock your STC portal for classes, materials, attendance, and academic updates.",
    destinationEmail: email,
    codeLabel: "Verification Code",
    codeValue: otp,
    tips: [
      "Check spam or promotions if the email does not land in your main inbox.",
      "Enter the most recent 6-digit code only. Older codes stop working after resend.",
    ],
    stats: [
      { label: "Valid For", value: `${OTP_EXPIRY_MINUTES} Minutes` },
      { label: "Security", value: "One-Time Use" },
    ],
    supportText:
      "Enter this code in the signup screen to activate your account. If you did not request this signup, you can safely ignore this email.",
    footer: "STC Academy | Gujarat, India | Mon-Sat | 8:00 AM - 8:00 PM",
  });
}

export async function POST(request: NextRequest) {
  try {
    // Early validation before any heavy operations
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { fullName, phone, email, password } = body;

    // Input validation with early returns
    if (!fullName || !phone || !email || !password) {
      return jsonNoStore(
        { error: "Full name, phone, email, and password are required." },
        400,
      );
    }

    // Normalize inputs
    const normalizedFullName = String(fullName).trim();
    const normalizedPhone = String(phone).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPassword = String(password);

    // Enhanced validation
    if (normalizedFullName.length < 2) {
      return jsonNoStore(
        { error: "Full name must be at least 2 characters long." },
        400,
      );
    }

    if (normalizedPhone.length < 10) {
      return jsonNoStore(
        { error: "Phone number must be at least 10 digits." },
        400,
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return jsonNoStore({ error: "Invalid email format." }, 400);
    }

    if (normalizedPassword.length < 6) {
      return jsonNoStore(
        { error: "Password must be at least 6 characters long." },
        400,
      );
    }

    // Build pending signup after validation
    const pendingSignup = buildPendingSignup({
      fullName: normalizedFullName,
      phone: normalizedPhone,
      email: normalizedEmail,
      password: normalizedPassword,
    });

    // Lazy initialization of Resend client only when needed
    let emailError: unknown = null;
    try {
      const resend = new Resend(apiKey);
      const fromEmail = getResendFromEmail();
      const emailResult = await resend.emails.send({
        from: fromEmail,
        to: [pendingSignup.email],
        subject: `${pendingSignup.otp} is your STC Academy signup code`,
        html: buildSignupOtpEmail({
          email: pendingSignup.email,
          name: pendingSignup.fullName || "Scholar",
          otp: pendingSignup.otp,
        }),
        text: `Welcome to STC Academy.

Your signup verification code is: ${pendingSignup.otp}

This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      });
      emailError = emailResult.error;
    } catch (error) {
      emailError = error;
    }

    // Build response
    const emailErrorMessage = emailError ? getErrorMessage(emailError) : null;
    const isDevBypass =
      !!emailErrorMessage &&
      canBypassResendInDevelopment() &&
      isResendTestingRestriction(emailErrorMessage);

    const response = NextResponse.json(
      {
        success: true,
        email: pendingSignup.email,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        ...(isDevBypass
          ? {
              deliveryMode: "development",
              devOtp: pendingSignup.otp,
              notice:
                "Resend sandbox blocked external delivery, so the OTP is shown here for local development.",
            }
          : {}),
      },
      { headers: NO_STORE_HEADERS },
    );

    // Handle email sending errors
    if (emailErrorMessage && !isDevBypass) {
      return jsonNoStore({ error: emailErrorMessage }, 500);
    }

    // Set cookie
    response.cookies.set(
      SIGNUP_OTP_COOKIE,
      encryptPendingSignup(pendingSignup),
      getSignupOtpCookieOptions(),
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send signup OTP";

    return jsonNoStore({ error: message }, 500);
  }
}
