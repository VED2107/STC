import { PageTransition } from "@/components/stitch/page-transition";

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <div>{children}</div>
    </PageTransition>
  );
}
