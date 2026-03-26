import { AtelierShell } from "@/components/stitch/atelier-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AtelierShell area="admin">{children}</AtelierShell>;
}
