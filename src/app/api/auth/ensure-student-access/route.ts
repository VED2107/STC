import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureOnlineStudentAccess } from "@/lib/auth/self-signup";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "student") {
      return NextResponse.json({ success: true, skipped: true });
    }

    await ensureOnlineStudentAccess({
      userId: user.id,
      fullName:
        profile?.full_name ||
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : user.email?.split("@")[0] ?? ""),
      phone:
        profile?.phone ||
        (typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : ""),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ensure student access." },
      { status: 500 },
    );
  }
}
