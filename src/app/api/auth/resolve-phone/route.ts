import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolve a phone number to the corresponding auth user email.
 *
 * This is used by the login form so that students who were bulk-uploaded
 * with only a phone number (no email) can still sign in with
 * phone + password.  We look up the profile by phone, then retrieve
 * the email from auth.users.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string };
    const phone = (body.phone ?? "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // 1. Try to find the profile by phone
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "No account found with that phone number." },
        { status: 404 },
      );
    }

    // 2. Get the email from auth.users
    const { data: authUser, error: authError } =
      await admin.auth.admin.getUserById(profile.id);

    if (authError || !authUser?.user) {
      return NextResponse.json(
        { error: "Could not resolve account. Please contact admin." },
        { status: 500 },
      );
    }

    const email = authUser.user.email;

    if (!email) {
      return NextResponse.json(
        {
          error:
            "This account does not have an email associated. Please contact admin to add an email.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ email });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to resolve phone number.",
      },
      { status: 500 },
    );
  }
}
