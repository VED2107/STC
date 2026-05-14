import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LOGIN_OTP_COOKIE,
  LOGIN_OTP_EXPIRY_MINUTES,
  buildPendingLogin,
  encryptPendingLogin,
  getLoginOtpCookieOptions,
} from "@/lib/auth/login-otp";
import {
  canBypassResendInDevelopment,
  getResendFromEmail,
  isResendTestingRestriction,
} from "@/lib/auth/resend";
import { buildStcEmailTemplate } from "@/lib/auth/email-theme";

async function authUserExists(email: string, adminClient: any) {
  try {
    // More efficient: try to get user by email directly instead of paginating all users
    const { data, error } = await adminClient.auth.admin.getUserByEmail(email);

    if (error) {
      // If getUserByEmail fails, user doesn't exist
      return false;
    }

    return !!data?.user;
  } catch {
    return false;
  }
}

function buildLoginOtpEmail({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) {
  return buildStcEmailTemplate({
    eyebrow: "OTP Login",
    title: "Check your email for the latest code",
    description:
      "We sent a one-time sign-in code through our Resend mail flow. It is valid for a short window and refreshes each time you request a new code.",
    destinationEmail: email,
    codeLabel: "Login Code",
    codeValue: otp,
    tips: [
      "Check spam or promotions if the email does not land in your main inbox.",
      "Enter the most recent 6-digit code only. Older codes stop working after resend.",
    ],
    stats: [
      { label: "Valid For", value: `${LOGIN_OTP_EXPIRY_MINUTES} Minutes` },
      { label: "Security", value: "One-Time Use" },
    ],
    supportText:
      "Enter this code in the login screen to continue. If you did not request it, you can safely ignore this email.",
    footer: `This code expires in ${LOGIN_OTP_EXPIRY_MINUTES} minutes.`,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Early validation before any heavy operations
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfigured for OTP login." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { email } = body;
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    // Input validation
    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 },
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 },
      );
    }

    // Single admin client instance for all operations
    const admin = createAdminClient();

    // Check if user exists using optimized method
    const userExists = await authUserExists(normalizedEmail, admin);
    if (!userExists) {
      return NextResponse.json(
        {
          error: "We couldn't find an account for that email. Please sign up first.",
          code: "USER_NOT_FOUND",
          suggestedAction: "signup",
        },
        { status: 404 },
      );
    }

    // Generate OTP link
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });

    if (linkError || !linkData.properties.email_otp) {
      return NextResponse.json(
        { error: "We could not send a login code for that email." },
        { status: 400 },
      );
    }

    // Lazy initialization of Resend client only when needed
    let emailError = null;
    try {
      const resend = new Resend(apiKey);
      const fromEmail = getResendFromEmail();
      const emailResult = await resend.emails.send({
        from: fromEmail,
        to: [normalizedEmail],
        subject: `${linkData.properties.email_otp} is your STC Academy login code`,
        html: buildLoginOtpEmail({
          email: normalizedEmail,
          otp: linkData.properties.email_otp,
        }),
        text: `Your STC Academy login code is ${linkData.properties.email_otp}. It expires in ${LOGIN_OTP_EXPIRY_MINUTES} minutes.`,
      });
      emailError = emailResult.error;
    } catch (error) {
      emailError = error;
    }

    // Build response
    const pendingLogin = buildPendingLogin(normalizedEmail);
    const response = NextResponse.json({
      success: true,
      email: normalizedEmail,
      expiresInMinutes: LOGIN_OTP_EXPIRY_MINUTES,
      ...(emailError &&
      canBypassResendInDevelopment() &&
      isResendTestingRestriction(emailError.message)
        ? {
            deliveryMode: "development",
            devOtp: linkData.properties.email_otp,
            notice:
              "Resend sandbox blocked external delivery, so the OTP is shown here for local development.",
          }
        : {}),
    });

    // Handle email sending errors
    if (
      emailError &&
      !(canBypassResendInDevelopment() && isResendTestingRestriction(emailError.message))
    ) {
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

    // Set cookie
    response.cookies.set(
      LOGIN_OTP_COOKIE,
      encryptPendingLogin(pendingLogin),
      getLoginOtpCookieOptions(),
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send login OTP";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
