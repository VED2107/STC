import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

// Environment validation and caching at module scope
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Server misconfigured: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

// Singleton admin client for better performance
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Create a Supabase admin client using the service-role key.
 *
 * This must only be called on the server (API routes, server actions,
 * server components). Uses singleton pattern for performance.
 */
export function createAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  // Prefer internal Docker URL for server-to-server calls
  adminClient = createClient<Database>(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return adminClient;
}
