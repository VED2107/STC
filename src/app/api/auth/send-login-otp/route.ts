import { NextRequest, NextResponse } from "next/server";
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

async function authUserExists(email: string) {
  const admin = createAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const users = data.users ?? [];
    const matchedUser = users.find((user) => user.email?.toLowerCase() === email);

    if (matchedUser) {
      return true;
    }

    if (users.length < 200) {
      return false;
    }

    page += 1;
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
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfigured for OTP login." },
        { status: 500 },
      );
    }

    const { email } = await request.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 },
      );
    }

    const userExists = await authUserExists(normalizedEmail);

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

    const admin = createAdminClient();

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

    const resend = new Resend(apiKey);
    const fromEmail = getResendFromEmail();
    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: [normalizedEmail],
      subject: `${linkData.properties.email_otp} is your STC Academy login code`,
      html: buildLoginOtpEmail({
        email: normalizedEmail,
        otp: linkData.properties.email_otp,
      }),
      text: `Your STC Academy login code is ${linkData.properties.email_otp}. It expires in ${LOGIN_OTP_EXPIRY_MINUTES} minutes.`,
    });

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

    if (
      emailError &&
      !(canBypassResendInDevelopment() && isResendTestingRestriction(emailError.message))
    ) {
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

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
