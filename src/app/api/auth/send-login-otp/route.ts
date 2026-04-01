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
  isResendTestingRestriction,
} from "@/lib/auth/resend";

function buildLoginOtpEmail({ otp }: { otp: string }) {
  return `
    <div style="margin:0;background:#09090b;padding:44px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e7e5e5;">
      <div style="max-width:680px;margin:0 auto;overflow:hidden;border:1px solid rgba(255,255,255,0.08);border-radius:34px;background:
        radial-gradient(circle at top right, rgba(89,160,255,0.18), transparent 32%),
        radial-gradient(circle at left center, rgba(240,216,175,0.12), transparent 36%),
        linear-gradient(180deg,#16171c 0%,#0f1014 100%);
        box-shadow:0 36px 100px rgba(0,0,0,0.46);">
        <div style="padding:22px 30px;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));">
          <div style="font-family:Georgia,Times New Roman,serif;font-size:24px;letter-spacing:-0.03em;color:#f0d8af;">
            STC Academy
          </div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(231,229,229,0.44);">
            Secure Login Code
          </div>
        </div>

        <div style="padding:46px 30px 34px;">
          <div style="display:inline-block;margin-bottom:20px;border:1px solid rgba(240,216,175,0.18);border-radius:999px;background:linear-gradient(90deg, rgba(240,216,175,0.12), rgba(89,160,255,0.08));padding:8px 14px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f0d8af;">
            One-Time Login
          </div>

          <h1 style="margin:0 0 16px;font-family:Georgia,Times New Roman,serif;font-size:44px;line-height:1.01;letter-spacing:-0.05em;color:#ffffff;">
            Your STC sign-in
            <br />
            code is ready
          </h1>

          <p style="margin:0 0 28px;font-size:16px;line-height:1.82;color:rgba(231,229,229,0.64);max-width:540px;">
            Use this secure one-time code to sign in to your STC portal. It works once and expires shortly for your account safety.
          </p>

          <div style="margin:30px 0 24px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);border-radius:30px;background:
            linear-gradient(135deg, rgba(89,160,255,0.08), rgba(255,255,255,0.015) 40%, rgba(240,216,175,0.08) 100%);
            padding:26px 24px 28px;text-align:center;">
            <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(231,229,229,0.34);">
              Login Code
            </div>
            <div style="margin:16px auto 0;max-width:420px;border-radius:22px;background:#0f1015;padding:18px 18px 20px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);">
              <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:48px;font-weight:800;letter-spacing:0.34em;color:#f0d8af;">
                ${otp}
              </div>
            </div>
            <div style="margin-top:14px;font-size:13px;line-height:1.7;color:rgba(231,229,229,0.44);">
              Enter this code in the login screen to continue.
            </div>
          </div>
        </div>

        <div style="padding:18px 30px;border-top:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);font-size:13px;color:rgba(231,229,229,0.40);">
          This code expires in ${LOGIN_OTP_EXPIRY_MINUTES} minutes. If you did not request it, you can safely ignore this email.
        </div>
      </div>
    </div>
  `;
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
    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "STC <onboarding@resend.dev>",
      to: [normalizedEmail],
      subject: `${linkData.properties.email_otp} is your STC Academy login code`,
      html: buildLoginOtpEmail({ otp: linkData.properties.email_otp }),
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
