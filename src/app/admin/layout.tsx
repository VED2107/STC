import { redirect } from "next/navigation";
import { AtelierShell } from "@/components/stitch/atelier-shell";
import { Providers } from "@/app/providers";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [
    {
      data: { session },
    },
    {
      data: { user },
    },
  ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

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

  return (
    <Providers
      initialAuth={{
        session,
        user,
        profile: profile ?? null,
      }}
    >
      <AtelierShell area="admin">{children}</AtelierShell>
    </Providers>
  );
}
