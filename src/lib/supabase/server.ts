import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/supabase";
import { cookies } from "next/headers";

// Environment validation at module scope for better performance
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export async function createClient() {
  const cookieStore = await cookies();

  // Prefer internal Docker URL for server-to-server calls
  return createServerClient<Database>(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if middleware refreshes sessions.
            console.warn("Cookie setting failed in server context:", error);
          }
        },
      },
    }
  );
}
