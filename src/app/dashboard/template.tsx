import { PageTransition } from "@/components/stitch/page-transition";

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <div>{children}</div>
    </PageTransition>
  );
}
