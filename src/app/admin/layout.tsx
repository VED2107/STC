import { redirect } from "next/navigation";
import { AtelierShell } from "@/components/stitch/atelier-shell";
import { AdminGreeting } from "@/components/stitch/admin-greeting";
import { getAdminAuth } from "@/lib/auth/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAdminAuth();

  if (!auth) {
    redirect("/login");
  }

  if (auth.role !== "admin" && auth.role !== "super_admin" && auth.role !== "teacher") {
    redirect("/dashboard");
  }

  return (
    <AtelierShell area="admin">
      <AdminGreeting name={auth.fullName || auth.email || "Admin"} />
      {children}
    </AtelierShell>
  );
}
