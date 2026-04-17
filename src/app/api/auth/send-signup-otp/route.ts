import { NextRequest, NextResponse } from "next/server";
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
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const { fullName, phone, email, password } = await request.json();

    if (!fullName || !phone || !email || !password) {
      return NextResponse.json(
        { error: "Full name, phone, email, and password are required." },
        { status: 400 },
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 },
      );
    }

    const pendingSignup = buildPendingSignup({
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      email: String(email).trim(),
      password: String(password),
    });

    const resend = new Resend(apiKey);
    const fromEmail = getResendFromEmail();
    const { error } = await resend.emails.send({
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

    const response = NextResponse.json({
      success: true,
      email: pendingSignup.email,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      ...(error && canBypassResendInDevelopment() && isResendTestingRestriction(error.message)
        ? {
            deliveryMode: "development",
            devOtp: pendingSignup.otp,
            notice:
              "Resend sandbox blocked external delivery, so the OTP is shown here for local development.",
          }
        : {}),
    });

    if (error && !(
      canBypassResendInDevelopment() && isResendTestingRestriction(error.message)
    )) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    response.cookies.set(
      SIGNUP_OTP_COOKIE,
      encryptPendingSignup(pendingSignup),
      getSignupOtpCookieOptions(),
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send signup OTP";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
