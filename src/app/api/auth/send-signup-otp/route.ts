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
  isResendTestingRestriction,
} from "@/lib/auth/resend";

function buildSignupOtpEmail({
  name,
  otp,
}: {
  name: string;
  otp: string;
}) {
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
            Premium Access Verification
          </div>
        </div>

        <div style="padding:46px 30px 34px;">
          <div style="display:inline-block;margin-bottom:20px;border:1px solid rgba(240,216,175,0.18);border-radius:999px;background:linear-gradient(90deg, rgba(240,216,175,0.12), rgba(89,160,255,0.08));padding:8px 14px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f0d8af;">
            One-Time Verification
          </div>

          <h1 style="margin:0 0 16px;font-family:Georgia,Times New Roman,serif;font-size:44px;line-height:1.01;letter-spacing:-0.05em;color:#ffffff;">
            Your STC account
            <br />
            is almost ready
          </h1>

          <p style="margin:0 0 8px;font-size:16px;line-height:1.8;color:rgba(231,229,229,0.78);">
            Hello ${name},
          </p>

          <p style="margin:0 0 28px;font-size:16px;line-height:1.82;color:rgba(231,229,229,0.64);max-width:540px;">
            Use this secure one-time code to complete signup and unlock your STC portal for classes, materials, attendance, and academic updates.
          </p>

          <div style="margin:30px 0 24px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);border-radius:30px;background:
            linear-gradient(135deg, rgba(89,160,255,0.08), rgba(255,255,255,0.015) 40%, rgba(240,216,175,0.08) 100%);
            padding:26px 24px 28px;text-align:center;">
            <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(231,229,229,0.34);">
              Verification Code
            </div>
            <div style="margin:16px auto 0;max-width:420px;border-radius:22px;background:#0f1015;padding:18px 18px 20px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);">
              <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:48px;font-weight:800;letter-spacing:0.34em;color:#f0d8af;">
                ${otp}
              </div>
            </div>
            <div style="margin-top:14px;font-size:13px;line-height:1.7;color:rgba(231,229,229,0.44);">
              Enter this code in the signup screen to activate your account.
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 28px;">
            <div style="border:1px solid rgba(255,255,255,0.07);border-radius:22px;padding:16px 18px;background:rgba(255,255,255,0.02);">
              <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(231,229,229,0.32);">
                Valid For
              </div>
              <div style="margin-top:8px;font-size:18px;font-weight:700;color:#ffffff;">
                ${OTP_EXPIRY_MINUTES} Minutes
              </div>
            </div>
            <div style="border:1px solid rgba(255,255,255,0.07);border-radius:22px;padding:16px 18px;background:rgba(255,255,255,0.02);">
              <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(231,229,229,0.32);">
                Security
              </div>
              <div style="margin-top:8px;font-size:18px;font-weight:700;color:#ffffff;">
                One-Time Use
              </div>
            </div>
          </div>

          <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(231,229,229,0.34);">
              Need help?
            </p>
            <p style="margin:0;font-size:14px;line-height:1.8;color:rgba(231,229,229,0.56);">
              If you did not request this signup, you can safely ignore this email. For help with admissions and portal access, reply to the STC support desk.
            </p>
          </div>
        </div>

        <div style="padding:18px 30px;border-top:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="font-size:13px;color:rgba(231,229,229,0.40);">
              STC Academy | Gujarat, India
            </div>
            <div style="font-size:13px;color:#f0d8af;">
              Mon-Sat | 8:00 AM - 8:00 PM
            </div>
          </div>
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
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "STC <onboarding@resend.dev>",
      to: [pendingSignup.email],
      subject: `${pendingSignup.otp} is your STC Academy signup code`,
      html: buildSignupOtpEmail({
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
