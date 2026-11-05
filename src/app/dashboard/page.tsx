"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  PlayCircle,
  QrCode,
  StickyNote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { getCached, setCache } from "@/lib/dashboard-cache";
import {
  RollStrip,
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { WelcomeGreeting } from "@/components/stitch/welcome-greeting";
import { cn } from "@/lib/utils";

/** Stable singleton — never changes between renders */
const supabase = createClient();

interface AttendanceRow {
  id: string;
  date: string;
  status: "present" | "absent";
  class?: { name: string } | null;
}

interface CourseRow {
  id: string;
  title: string;
  subject: string;
  class_id?: string;
}

interface MaterialRow {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video" | "link";
}

interface SyllabusRow {
  id: string;
  subject: string;
  class_id: string;
}

interface StudentRecord {
  id: string;
  class_id: string;
  branch_id?: string | null;
  student_type: "tuition" | "online";
  class?: { name: string; board: string; level: string } | null;
  branch?: { id: string; name: string } | null;
}

function StudentDashboardInner() {
  const router = useRouter();
  const { user, profile, role, loading: authLoading } = useAuth();

  const [userName, setUserName] = useState("Student");
  const [loading, setLoading] = useState(true);
  const [studentRecord, setStudentRecord] = useState<StudentRecord | null>(null);
  const [stats, setStats] = useState({
    courses: 0,
    attendanceRate: 0,
    materials: 0,
    notifications: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRow[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseRow[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<MaterialRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authLoading || cancelled) return;
      if (!user) {
        router.push("/login");
        return;
      }

      setUserName(profile?.full_name || user.user_metadata?.full_name || user.email || "Student");

      if (role === "admin" || role === "super_admin" || role === "teacher") {
        setLoading(false);
        return;
      }

      const dashCacheKey = `student:dashboard:${user.id}`;
      const cached = getCached<{
        studentRecord: StudentRecord;
        stats: typeof stats;
        recentAttendance: AttendanceRow[];
        enrolledCourses: CourseRow[];
        recentMaterials: MaterialRow[];
      }>(dashCacheKey);

      if (cached) {
        setStudentRecord(cached.studentRecord);
        setStats(cached.stats);
        setRecentAttendance(cached.recentAttendance);
        setEnrolledCourses(cached.enrolledCourses);
        setRecentMaterials(cached.recentMaterials);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const classContextResponse = await fetch("/api/student/class-context", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!classContextResponse.ok) {
        setLoading(false);
        return;
      }

      const classContext = (await classContextResponse.json()) as {
        student: StudentRecord | null;
        class: StudentRecord["class"];
        branch: StudentRecord["branch"];
        courses: CourseRow[];
      };

      if (!classContext.student || cancelled) {
        setLoading(false);
        return;
      }

      const typedStudent = {
        ...classContext.student,
        class: classContext.class ?? null,
        branch: classContext.branch ?? null,
      } as StudentRecord;

      const isTuition = typedStudent.student_type === "tuition";
      type QueryResult = {
        data: unknown;
        count?: number | null;
        error?: unknown;
      };

      // ── Build a single query batch ──────────────────────────────
      // Base queries every student needs (indices 0-3)
      const queries: Array<PromiseLike<QueryResult>> = [
        /* 0 */ supabase
          .from("attendance")
          .select("id, date, status, class:classes(name)")
          .eq("student_id", typedStudent.id)
          .order("date", { ascending: false })
          .limit(24),
        /* 1 */ supabase
          .from("enrollments")
          .select("course:courses(id, title, subject, class_id)")
          .eq("student_id", typedStudent.id)
          .eq("status", "active"),
        /* 2 */ supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("student_id", typedStudent.id)
          .eq("status", "pending"),
        /* 3 */ supabase
          .from("enrollments")
          .select("course_id, course:courses(class_id)")
          .eq("student_id", typedStudent.id)
          .eq("status", "active"),
      ];

      // For tuition students we already have class_id — add materials
      // + attendance rate queries to the SAME batch (indices 4-7)
      if (isTuition) {
        queries.push(
          /* 4 */ supabase
            .from("materials")
            .select("id", { count: "exact", head: true })
            .eq("class_id", typedStudent.class_id),
          /* 5 */ supabase
            .from("materials")
            .select("id, title, type")
            .eq("class_id", typedStudent.class_id)
            .order("created_at", { ascending: false })
            .limit(4),
          /* 6 */ supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("student_id", typedStudent.id),
          /* 7 */ supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("student_id", typedStudent.id)
            .eq("status", "present"),
          /* 8 */ supabase
            .from("syllabus")
            .select("id, subject, class_id")
            .eq("class_id", typedStudent.class_id)
            .order("subject"),
        );
      }

      const results = await Promise.all(queries);

      // ── Extract base results (all students) ─────────────────────
      const attendanceRes = results[0];
      const coursesRes = results[1];
      const notifsRes = results[2];
      const enrollmentsRes = results[3];

      const activeClassIds = Array.from(
        new Set(
          ((enrollmentsRes.data as { course?: { class_id?: string } | null }[] | null) ?? [])
            .map((entry) => entry.course?.class_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let materialsCount = 0;
      let recentMats: MaterialRow[] = [];
      let rate = 0;
      let studies: CourseRow[] = [];

      if (isTuition) {
        // Results already in the batch (indices 4-7)
        materialsCount = results[4].count ?? 0;
        recentMats = (results[5].data as MaterialRow[] | null) ?? [];
        const totalAtt = results[6].count ?? 0;
        const presentAtt = results[7].count ?? 0;
        rate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
        studies = (((results[8].data as SyllabusRow[] | null) ?? []).map((entry) => ({
          id: entry.id,
          title: entry.subject,
          subject: entry.subject,
          class_id: entry.class_id,
        })));
      } else if (activeClassIds.length > 0) {
        // Online students: use enrolled class context so dashboard matches materials/syllabus pages
        const [materialsRes, recentMaterialsRes] = await Promise.all([
          supabase
            .from("materials")
            .select("id", { count: "exact", head: true })
            .in("class_id", activeClassIds),
          supabase
            .from("materials")
            .select("id, title, type")
            .in("class_id", activeClassIds)
            .order("created_at", { ascending: false })
            .limit(4),
        ]);
        materialsCount = materialsRes.count ?? 0;
        recentMats = (recentMaterialsRes.data as MaterialRow[] | null) ?? [];
      }

      const courseEntries =
        (coursesRes.data as Array<{ course: unknown }> | null) ?? [];

      const courses = courseEntries
        .map((entry: { course: unknown }) => entry.course as unknown as CourseRow | null)
        .filter(Boolean) as CourseRow[];
      if (!isTuition) {
        studies = courses;
      }

      if (cancelled) return;
      const nextStats = {
        courses: studies.length,
        attendanceRate: rate,
        materials: materialsCount,
        notifications: notifsRes.count ?? 0,
      };
      const nextAttendance = (attendanceRes.data as AttendanceRow[] | null) ?? [];
      setStudentRecord(typedStudent);
      setRecentAttendance(nextAttendance);
      setEnrolledCourses(studies);
      setRecentMaterials(recentMats);
      setStats(nextStats);
      setLoading(false);

      setCache(`student:dashboard:${user.id}`, {
        studentRecord: typedStudent,
        stats: nextStats,
        recentAttendance: nextAttendance,
        enrolledCourses: studies,
        recentMaterials: recentMats,
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profile?.full_name, role, router, user]);

  const isOnlineStudent = studentRecord?.student_type === "online";

  const materialIconMap: Record<string, { icon: typeof FileText; accent: string }> = {
    pdf: { icon: FileText, accent: "bg-danger-soft text-destructive" },
    video: { icon: PlayCircle, accent: "bg-success-soft text-success" },
    notes: { icon: StickyNote, accent: "bg-info-soft text-info" },
    link: { icon: ExternalLink, accent: "bg-warning-soft text-warning" },
  };

  const showGreeting = !loading && !authLoading && !!user;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  if (role === "admin" || role === "super_admin" || role === "teacher") {
    return (
      <div className="px-4 py-6 md:px-8">
        {showGreeting && <WelcomeGreeting name={userName} />}
        <div className={stitchPanelClass}>
          <h1 className="text-5xl text-foreground">
            {role === "teacher" ? "Teacher Access Active" : "Admin Access Active"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
            This workspace is for student accounts. Continue to the command
            center to manage faculty, structures, curriculum, and registry
            operations.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/admin" className={cn(stitchButtonClass)}>
              {role === "teacher" ? "Go to Teacher Workspace" : "Go to Dashboard"}
            </Link>
            <Link
              href="/admin/qr-scan"
              className={cn(stitchSecondaryButtonClass, "gap-2")}
            >
              <QrCode className="h-4 w-4" />
              Scan Student QR
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!studentRecord) {
    return (
      <div className="px-4 py-6 md:px-8">
        <WelcomeGreeting name={userName} isNewUser />
        <StitchSectionHeader
          eyebrow="Student Dashboard"
          title={`Welcome,\n${userName.split(" ")[0]}.`}
          description="Your account is active, but class access is waiting for admin assignment."
        />

        <div className={stitchPanelClass}>
          <h2 className="text-xl text-foreground">Assignment Pending</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Your signup is complete, but only an admin can attach your account to a class. Once that happens, your syllabus, materials, attendance, and class details will appear here.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard/settings" className={stitchButtonClass}>
              Review Profile
            </Link>
            <Link href="/about-us" className={stitchSecondaryButtonClass}>
              Contact STC
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const firstName = userName.split(" ")[0];
  const presentCount = recentAttendance.filter((entry) => entry.status === "present").length;

  return (
    <div className="px-4 py-6 md:px-8">
      <WelcomeGreeting name={userName} />
      <h1 className="text-3xl text-primary md:text-4xl">Hello, {firstName}</h1>
      <p className="mt-1 text-muted-foreground">
        {studentRecord.class?.name ?? "Class not assigned yet"}
        {studentRecord.class?.board ? `, ${studentRecord.class.board}` : ""}
        {studentRecord.branch ? `, ${studentRecord.branch.name}` : ""}
      </p>

      <div className={cn("mt-6 grid gap-6", !isOnlineStudent && "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]")}>
        {isOnlineStudent ? null : (
          <section aria-labelledby="my-attendance" className="stitch-panel p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="my-attendance" className="text-xl text-primary">My attendance</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recentAttendance.length > 0
                    ? `Present ${presentCount} of the last ${recentAttendance.length} sessions`
                    : "Your sessions will appear here once attendance is marked."}
                </p>
              </div>
              <p className="tnum text-4xl font-bold text-primary md:text-5xl">{stats.attendanceRate}%</p>
            </div>
            <RollStrip marks={recentAttendance} className="mt-5 min-h-5" />
            <Link href="/dashboard/attendance" className="mt-5 inline-block text-sm font-semibold text-secondary underline underline-offset-4">
              See full attendance
            </Link>
          </section>
        )}

        <section aria-labelledby="my-subjects" className="stitch-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="my-subjects" className="text-xl text-primary">{isOnlineStudent ? "My courses" : "My subjects"}</h2>
            <Link href="/dashboard/syllabus" className="text-sm font-semibold text-secondary hover:underline">Syllabus</Link>
          </div>
          {enrolledCourses.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {isOnlineStudent
                ? "Your courses will appear here once enrollment is available."
                : "Your subjects will appear here once your class is assigned."}
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {enrolledCourses.map((course) => (
                <li key={course.id} className="rounded-md bg-gold-100 px-3 py-1.5 text-sm font-medium text-primary">
                  {course.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="new-materials" className="stitch-panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <h2 id="new-materials" className="text-xl text-primary">New study materials</h2>
          <Link href="/dashboard/materials" className="text-sm font-semibold text-secondary hover:underline">
            All {stats.materials > 0 ? stats.materials : ""} materials
          </Link>
        </div>
        {recentMaterials.length === 0 ? (
          <p className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
            {isOnlineStudent
              ? "No materials are published for your courses yet."
              : "No materials are published for your class yet."}
          </p>
        ) : (
          <ul className="divide-y border-t">
            {recentMaterials.map((material) => {
              const meta = materialIconMap[material.type] ?? materialIconMap.notes;
              const Icon = meta.icon;
              return (
                <li key={material.id}>
                  <Link href="/dashboard/materials" className="flex min-h-14 items-center gap-3 px-5 py-2 transition-colors duration-(--duration-fast) hover:bg-surface-container-low">
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.accent)}>
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{material.title}</span>
                    <span className="text-sm text-muted-foreground">{material.type === "pdf" ? "PDF" : material.type[0].toUpperCase() + material.type.slice(1)}</span>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <StudentDashboardInner />
    </Suspense>
  );
}
