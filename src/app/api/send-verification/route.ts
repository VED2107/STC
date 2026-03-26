import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

function buildVerificationEmail({
  name,
  confirmUrl,
}: {
  name?: string;
  confirmUrl: string;
}) {
  const greeting = name ? `Welcome to STC Academy, ${name}` : "Welcome to STC Academy";

  return `
    <div style="margin:0;background:#0e0e0e;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e7e5e5;">
      <div style="max-width:640px;margin:0 auto;overflow:hidden;border:1px solid rgba(255,255,255,0.08);border-radius:28px;background:linear-gradient(180deg,#171717 0%,#111111 100%);box-shadow:0 30px 80px rgba(0,0,0,0.35);">
        <div style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
          <div style="font-family:Georgia,Times New Roman,serif;font-size:24px;letter-spacing:-0.03em;color:#d7c4a5;">
            STC Academy
          </div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(231,229,229,0.46);">
            The Digital Atelier
          </div>
        </div>

        <div style="padding:40px 28px 32px;">
          <div style="display:inline-block;margin-bottom:18px;border:1px solid rgba(215,196,165,0.18);border-radius:999px;background:rgba(215,196,165,0.08);padding:8px 14px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#d7c4a5;">
            Email Verification
          </div>

          <h1 style="margin:0 0 16px;font-family:Georgia,Times New Roman,serif;font-size:38px;line-height:1.05;letter-spacing:-0.04em;color:#ffffff;">
            ${greeting}
          </h1>

          <p style="margin:0 0 14px;font-size:16px;line-height:1.8;color:rgba(231,229,229,0.72);">
            Your portal access is almost ready. Please verify your email address to activate your STC account and continue into the student platform.
          </p>

          <p style="margin:0 0 28px;font-size:16px;line-height:1.8;color:rgba(231,229,229,0.72);">
            Once confirmed, you can review your classes, study materials, attendance, and academic updates from a single dashboard.
          </p>

          <a
            href="${confirmUrl}"
            style="display:inline-block;border-radius:999px;background:#d7c4a5;padding:14px 26px;color:#4b3e27;font-size:15px;font-weight:700;text-decoration:none;"
          >
            Verify Email Address
          </a>

          <div style="margin-top:28px;border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(231,229,229,0.34);">
              Need help?
            </p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:rgba(231,229,229,0.56);">
              If the button does not work, copy and paste this link into your browser:
            </p>
            <p style="margin:12px 0 0;word-break:break-all;font-size:14px;line-height:1.7;color:#d7c4a5;">
              ${confirmUrl}
            </p>
          </div>
        </div>

        <div style="padding:18px 28px;border-top:1px solid rgba(255,255,255,0.08);font-size:13px;line-height:1.7;color:rgba(231,229,229,0.42);">
          If you did not create an STC account, you can safely ignore this email.
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

    const resend = new Resend(apiKey);
    const { email, name, confirmUrl } = await request.json();

    if (!email || !confirmUrl) {
      return NextResponse.json(
        { error: "Email and confirmUrl are required" },
        { status: 400 },
      );
    }

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "STC <onboarding@resend.dev>",
      to: [email],
      subject: "Verify your STC Academy email address",
      html: buildVerificationEmail({ name, confirmUrl }),
      text: `Welcome to STC Academy${name ? `, ${name}` : ""}.

Verify your email address to activate your account:
${confirmUrl}

If you did not create this account, you can safely ignore this email.`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send verification email";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
