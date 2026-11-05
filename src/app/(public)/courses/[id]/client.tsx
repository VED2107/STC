"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  PlayCircle,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import type { Course, Material } from "@/lib/types/database";
import {
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

type CourseWithRelations = Omit<Course, "class" | "teacher"> & {
  class: { name: string; board: string; level: string } | null;
  teacher: { name: string; qualification: string; bio: string | null } | null;
};

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      prefill?: { name?: string; email?: string };
      theme?: { color?: string };
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => void | Promise<void>;
      modal?: { ondismiss?: () => void };
    }) => { open: () => void };
  }
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CourseDetailClient({ courseId }: { courseId: string }) {
  const router = useRouter();

  const [course, setCourse] = useState<CourseWithRelations | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isStudentUser, setIsStudentUser] = useState(false);
  const [isOnlineStudent, setIsOnlineStudent] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  useEffect(() => {
    const fetchCourse = async () => {
      const supabase = createClient();

      const [{ data: courseData }, { data: materialData }] = await Promise.all([
        supabase
          .from("courses")
          .select(
            `
              *,
              class:classes(name, board, level),
              teacher:teachers(name, qualification, bio)
            `
          )
          .eq("is_online_only", true)
          .eq("is_active", true)
          .eq("id", courseId)
          .single(),
        supabase
          .from("materials")
          .select("id, title, type, file_url, sort_order, course_id")
          .eq("course_id", courseId)
          .order("sort_order", { ascending: true }),
      ]);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthenticated(Boolean(user));

      if (user) {
        const [{ data: profile }, { data: student }] = await Promise.all([
          supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
          supabase.from("students").select("id, student_type").eq("profile_id", user.id).maybeSingle(),
        ]);

        if (profile?.role === "student") {
          setIsStudentUser(true);
          setIsOnlineStudent((student?.student_type ?? "online") === "online");
          if (student?.id) {
            const { data: enrollment } = await supabase
              .from("enrollments")
              .select("id")
              .eq("student_id", student.id)
              .eq("course_id", courseId)
              .eq("status", "active")
              .maybeSingle();
            setIsEnrolled(Boolean(enrollment));
          } else {
            setIsEnrolled(false);
          }
        } else {
          setIsStudentUser(false);
          setIsOnlineStudent(false);
          setIsEnrolled(false);
        }
      } else {
        setIsStudentUser(false);
        setIsOnlineStudent(false);
        setIsEnrolled(false);
      }

      setCourse((courseData as CourseWithRelations | null) ?? null);
      setMaterials((materialData as Material[] | null) ?? []);
      setLoading(false);
    };

    void fetchCourse();
  }, [courseId]);

  async function handlePurchase() {
    setPurchaseError("");
    setPurchaseLoading(true);
    try {
      const courseFee = Number(course?.fee_inr ?? 0);

      if (courseFee <= 0) {
        const response = await fetch("/api/courses/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId }),
        });
        const payload = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !payload.success) {
          setPurchaseError(payload.error ?? "Could not complete enrollment.");
          return;
        }
        setIsEnrolled(true);
        router.push("/dashboard/materials");
        return;
      }

      const orderResponse = await fetch("/api/courses/checkout-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const orderPayload = (await orderResponse.json()) as {
        success?: boolean;
        error?: string;
        orderId?: string;
        amountInPaise?: number;
        currency?: string;
        keyId?: string;
        courseTitle?: string;
        studentName?: string;
        studentEmail?: string;
      };

      if (!orderResponse.ok || !orderPayload.success || !orderPayload.orderId || !orderPayload.keyId) {
        setPurchaseError(orderPayload.error ?? "Could not start Razorpay checkout.");
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setPurchaseError("Could not load Razorpay checkout.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: orderPayload.keyId,
        amount: orderPayload.amountInPaise ?? courseFee * 100,
        currency: orderPayload.currency ?? "INR",
        name: "STC Academy",
        description: orderPayload.courseTitle ?? course?.title ?? "Course Purchase",
        order_id: orderPayload.orderId,
        prefill: {
          name: orderPayload.studentName,
          email: orderPayload.studentEmail,
        },
        theme: { color: "#c79c3f" },
        handler: async (rzpResponse) => {
          const verifyResponse = await fetch("/api/courses/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId,
              ...rzpResponse,
            }),
          });
          const verifyPayload = (await verifyResponse.json()) as { success?: boolean; error?: string };
          if (!verifyResponse.ok || !verifyPayload.success) {
            setPurchaseError(verifyPayload.error ?? "Payment verification failed.");
            return;
          }

          setIsEnrolled(true);
          router.push("/dashboard/materials");
        },
        modal: {
          ondismiss: () => {
            setPurchaseLoading(false);
          },
        },
      });

      razorpay.open();
      return;
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Could not complete checkout.";
      setPurchaseError(message);
    } finally {
      setPurchaseLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-20 md:px-8">
        <div className={cn(stitchPanelClass, "text-center")}>
          <GraduationCap className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-6 text-5xl text-primary">Course Not Found</h1>
          <p className="mt-4 text-muted-foreground">
            The requested course could not be found.
          </p>
          <Link href="/online-courses" className={cn(stitchButtonClass, "mt-8")}>
            All online courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14">
      <Link
        href="/online-courses"
        className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All online courses
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_360px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="stitch-pill bg-accent px-3 py-1 text-xs text-accent-foreground">
              {course.subject}
            </span>
            <span className="stitch-pill px-3 py-1 text-xs">
              {course.class?.board ?? "STC"} {course.class?.level ?? "Series"}
            </span>
          </div>

          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] text-primary md:text-6xl">
            {course.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">
            {course.description}
          </p>

          <div className="mt-10">
            <div className={stitchPanelClass}>
              <p className="stitch-kicker">The Instructor</p>
              <h2 className="mt-2 text-2xl text-primary">
                {course.teacher?.name ?? "STC Faculty"}
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {course.teacher?.bio ||
                  `${course.teacher?.qualification ?? "STC faculty"}.`}
              </p>
              <div className="mt-8 rounded-xl bg-muted p-5">
                <p className="text-sm font-medium text-foreground/80">
                  {course.teacher?.qualification ?? "STC faculty"}
                </p>
              </div>
            </div>

          </div>

          <div className="mt-6">
            <div className={stitchPanelClass}>
                            <h3 className="mt-1 text-2xl text-primary">Study materials</h3>
              <div className="mt-6 space-y-3">
                {materials.length === 0 ? (
                  <div className={cn(stitchPanelSoftClass, "text-muted-foreground")}>
                    Materials will appear here once new lessons are published.
                  </div>
                ) : (
                  materials.map((material) => (
                    <a
                      key={material.id}
                      href={material.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        stitchPanelSoftClass,
                        "flex items-center justify-between gap-4 transition hover:border-primary/12"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary stitch-ghost-border">
                          {material.type === "video" ? (
                            <PlayCircle className="h-5 w-5" />
                          ) : material.type === "link" ? (
                            <ExternalLink className="h-5 w-5" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-base font-medium text-primary">
                            {material.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {material.type}
                          </p>
                        </div>
                      </div>
                      <Download className="h-4 w-4 text-primary" />
                    </a>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        <aside>
          <div className={cn(stitchPanelClass, "sticky top-28")}>
            <p className="stitch-kicker">Course Fee</p>
            <p className="mt-4 tnum text-4xl font-bold text-primary">{formatInr(Number(course.fee_inr ?? 0))}</p>
            {!isAuthenticated ? (
              <Link href="/login" className={cn(stitchButtonClass, "mt-7 w-full")}>
                Sign in to buy
              </Link>
            ) : isEnrolled ? (
              <Link href="/dashboard/materials" className={cn(stitchButtonClass, "mt-7 w-full")}>
                Open materials
              </Link>
            ) : isStudentUser && !isOnlineStudent ? (
              <p className="mt-7 text-sm text-muted-foreground">
                Tuition students already get class access from admin assignment.
              </p>
            ) : (
              <button
                type="button"
                className={cn(stitchButtonClass, "mt-7 w-full")}
                onClick={() => void handlePurchase()}
                disabled={purchaseLoading}
              >
                {purchaseLoading
                  ? "Processing..."
                  : Number(course.fee_inr ?? 0) > 0
                    ? "Buy with Razorpay"
                    : "Enroll Free"}
              </button>
            )}
            {purchaseError ? <p className="mt-3 text-xs text-destructive">{purchaseError}</p> : null}
            <div className="mt-8 space-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Board
                </span>
                <span>{course.class?.board ?? "STC"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Materials
                </span>
                <span>{materials.length} published</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}