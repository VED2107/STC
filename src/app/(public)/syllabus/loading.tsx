import { LoadingAnimation } from "@/components/ui/loading-animation";

export default function SyllabusLoading() {
  return (
    <div className="mx-auto max-w-[1600px] px-6 py-16 md:px-12">
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingAnimation size="lg" />
      </div>
    </div>
  );
}