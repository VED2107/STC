import { LoadingAnimation } from "@/components/ui/loading-animation";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingAnimation size="lg" />
    </div>
  );
}