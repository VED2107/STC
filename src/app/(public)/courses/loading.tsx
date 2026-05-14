import { LoadingAnimation } from "@/components/ui/loading-animation";

export default function CoursesLoading() {
  return (
    <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8 md:py-18">
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingAnimation size="lg" />
      </div>
    </div>
  );
}