import { redirect } from "next/navigation";
import { AtelierShell } from "@/components/stitch/atelier-shell";
import { createClient } from "@/lib/supabase/server";

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
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "super_admin" && profile?.role !== "teacher") {
    redirect("/dashboard");
  }

  return <AtelierShell area="admin">{children}</AtelierShell>;
}
