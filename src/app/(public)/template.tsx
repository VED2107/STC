import { PageTransition } from "@/components/stitch/page-transition";

export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition variant="public">
      <div>{children}</div>
    </PageTransition>
  );
}
