import { redirect } from "next/navigation";
import { AtelierShell } from "@/components/stitch/atelier-shell";
import { AdminGreeting } from "@/components/stitch/admin-greeting";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
    .overrideTypes<{ role: UserRole } | null, { merge: false }>();

  if (profile?.role !== "admin" && profile?.role !== "super_admin" && profile?.role !== "teacher") {
    redirect("/dashboard");
  }

  const { data: fullProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AtelierShell area="admin">
      <AdminGreeting name={fullProfile?.full_name || user.email || "Admin"} />
      {children}
    </AtelierShell>
  );
}
