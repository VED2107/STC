import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export interface AdminAuth {
  userId: string;
  email: string | null;
  role: UserRole | null;
  fullName: string | null;
}

/**
 * Resolve the current admin user + role in ONE getUser() call and ONE profile
 * query, deduplicated per-request via React `cache()`.
 *
 * The admin layout and each admin server page previously called
 * `supabase.auth.getUser()` + a `profiles` role query independently, so a
 * single admin navigation issued the auth round-trip 2–3× against Supabase.
 * Wrapping it in `cache()` collapses all callers in the same request render
 * into a single set of network round-trips.
 */
export const getAdminAuth = cache(async (): Promise<AdminAuth | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as { role: UserRole; full_name: string | null } | null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile?.role ?? null,
    fullName: profile?.full_name ?? null,
  };
});
