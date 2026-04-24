import { NextResponse } from "next/server";

/**
 * DEBUG ONLY — remove after testing.
 * Hit GET /api/debug-supabase to check connectivity.
 */
export async function GET() {
  const internalUrl = process.env.SUPABASE_URL;
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const resolvedUrl = internalUrl || publicUrl;

  const results: Record<string, unknown> = {
    SUPABASE_URL: internalUrl ?? "(not set)",
    NEXT_PUBLIC_SUPABASE_URL: publicUrl ?? "(not set)",
    resolved_url: resolvedUrl ?? "(none)",
    service_role_key_prefix: serviceRoleKey ? serviceRoleKey.substring(0, 20) + "..." : "(not set)",
    anon_key_prefix: anonKey ? anonKey.substring(0, 20) + "..." : "(not set)",
  };

  // Test 1: Can we reach Kong at all?
  try {
    const healthRes = await fetch(`${resolvedUrl}/auth/v1/health`, {
      headers: { apikey: anonKey || "" },
    });
    results.health_status = healthRes.status;
    results.health_body = await healthRes.text();
  } catch (err) {
    results.health_error = err instanceof Error ? err.message : String(err);
  }

  // Test 2: Can the service role key call admin API?
  try {
    const adminRes = await fetch(`${resolvedUrl}/auth/v1/admin/users?per_page=1`, {
      headers: {
        apikey: serviceRoleKey || "",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    results.admin_status = adminRes.status;
    const adminBody = await adminRes.text();
    results.admin_body = adminBody.length > 500 ? adminBody.substring(0, 500) + "..." : adminBody;
  } catch (err) {
    results.admin_error = err instanceof Error ? err.message : String(err);
  }

  // Test 3: Try with Supabase JS client
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(resolvedUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });
    results.supabase_js_error = error ? { message: error.message, status: error.status } : null;
    results.supabase_js_user_count = data?.users?.length ?? 0;
  } catch (err) {
    results.supabase_js_crash = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(results, { status: 200 });
}
