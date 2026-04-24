import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase admin client using the service-role key.
 *
 * This must only be called on the server (API routes, server actions,
 * server components). Throws if the required env vars are missing.
 */
export function createAdminClient() {
  // Prefer internal Docker URL for server-to-server calls
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Server misconfigured: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
