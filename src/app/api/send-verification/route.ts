import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { buildStcEmailTemplate } from "@/lib/auth/email-theme";
import { getResendFromEmail } from "@/lib/auth/resend";

// Move to module scope for better performance
const buildVerificationEmail = ({
  name,
  confirmUrl,
}: {
  name?: string;
  confirmUrl: string;
}): string => {
  const greeting = name ? `Welcome to STC Academy, ${name}` : "Welcome to STC Academy";

  return buildStcEmailTemplate({
    eyebrow: "Email Verification",
    title: greeting,
    description:
      "Your portal access is almost ready. Please verify your email address to activate your STC account and continue into the student platform. Once confirmed, you can review your classes, study materials, attendance, and academic updates from a single dashboard.",
    actionLabel: "Verify Email Address",
    actionUrl: confirmUrl,
    supportText: "If the button does not work, copy and paste this link into your browser:",
    supportUrl: confirmUrl,
    footer: "If you did not create an STC account, you can safely ignore this email.",
  });
};

// Environment validation at module scope
const apiKey = process.env.RESEND_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Early environment validation
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Input validation with early returns
    const { email, name, confirmUrl } = await request.json();

    if (!email || !confirmUrl) {
      return NextResponse.json(
        { error: "Email and confirmUrl are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // URL format validation
    if (!confirmUrl.startsWith('http')) {
      return NextResponse.json(
        { error: "Invalid confirm URL format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Lazy initialization of Resend client only when needed
    const resend = new Resend(apiKey);
    const fromEmail = getResendFromEmail();

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: "Verify your STC Academy email address",
      html: buildVerificationEmail({ name, confirmUrl }),
      text: `Welcome to STC Academy${name ? `, ${name}` : ""}.

Verify your email address to activate your account:
${confirmUrl}

If you did not create this account, you can safely ignore this email.`,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { success: true, id: data?.id },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send verification email";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
