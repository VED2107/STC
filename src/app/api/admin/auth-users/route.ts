import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── In-memory cache (60 s TTL) ──────────────────────────────────
// Prevents hammering Supabase Auth Admin API on every page load.
let cachedPayload: { users: Array<{ id: string; email: string; full_name: string; phone: string }> } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Serve from cache if fresh
    if (cachedPayload && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedPayload, {
        headers: { "Cache-Control": "private, max-age=60" },
      });
    }

    const admin = createAdminClient();

    const {
      data: { users },
      error,
    } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    cachedPayload = {
      users: (users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? "",
        full_name:
          typeof u.user_metadata?.full_name === "string"
            ? u.user_metadata.full_name
            : typeof u.user_metadata?.name === "string"
              ? u.user_metadata.name
              : "",
        phone:
          typeof u.user_metadata?.phone === "string"
            ? u.user_metadata.phone
            : "",
      })),
    };
    cacheTimestamp = Date.now();

    return NextResponse.json(cachedPayload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load auth users." },
      { status: 500 },
    );
  }
}

