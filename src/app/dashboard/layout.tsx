import { AtelierShell } from "@/components/stitch/atelier-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AtelierShell area="student">{children}</AtelierShell>;
}
