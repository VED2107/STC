import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureOnlineStudentAccess } from "@/lib/auth/self-signup";

export async function POST() {
  try {
    const supabase = await createClient();

    // Early auth validation
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Optimized profile query - select only what we need
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    // Early return if user is not a student
    if (profile?.role && profile.role !== "student") {
      return NextResponse.json(
        { success: true, skipped: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Extract user metadata once for efficiency
    const userMetadata = user.user_metadata || {};

    // Ensure student access with fallback values
    await ensureOnlineStudentAccess({
      userId: user.id,
      fullName:
        profile?.full_name ||
        (typeof userMetadata.full_name === "string"
          ? userMetadata.full_name
          : typeof userMetadata.name === "string"
            ? userMetadata.name
            : user.email?.split("@")[0] ?? ""),
      phone:
        profile?.phone ||
        (typeof userMetadata.phone === "string" ? userMetadata.phone : ""),
      email: user.email,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ensure student access." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
