import { LoadingAnimation } from "@/components/ui/loading-animation";

export default function CourseDetailLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8 md:py-16">
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingAnimation size="lg" />
      </div>
    </div>
  );
}