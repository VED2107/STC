"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  QrCode,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
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
  student_type: "tuition" | "online";
  class?: { name: string; board: string; level: string } | null;
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user, profile, role, loading: authLoading } = useAuth();

  const [userName, setUserName] = useState("Scholar");
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

      setLoading(true);
      setUserName(profile?.full_name || user.user_metadata?.full_name || user.email || "Scholar");

    if (role === "admin" || role === "super_admin" || role === "teacher") {
        setLoading(false);
        return;
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
        courses: CourseRow[];
      };

      if (!classContext.student || cancelled) {
        setLoading(false);
        return;
      }

      const typedStudent = {
        ...classContext.student,
        class: classContext.class ?? null,
      } as StudentRecord;

      const isTuition = typedStudent.student_type === "tuition";

      // ── Build a single query batch ──────────────────────────────
      // Base queries every student needs (indices 0-3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queries: Promise<any>[] = [
        /* 0 */ supabase
          .from("attendance")
          .select("id, date, status, class:classes(name)")
          .eq("student_id", typedStudent.id)
          .order("date", { ascending: false })
          .limit(4),
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

      const courses = (coursesRes.data ?? [])
        .map((entry: { course: unknown }) => entry.course as unknown as CourseRow | null)
        .filter(Boolean) as CourseRow[];
      if (!isTuition) {
        studies = courses;
      }

      if (cancelled) return;
      setStudentRecord(typedStudent);
      setRecentAttendance((attendanceRes.data as AttendanceRow[] | null) ?? []);
      setEnrolledCourses(studies);
      setRecentMaterials(recentMats);
      setStats({
        courses: studies.length,
        attendanceRate: rate,
        materials: materialsCount,
        notifications: notifsRes.count ?? 0,
      });
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profile?.full_name, role, router, user]);

  const isOnlineStudent = studentRecord?.student_type === "online";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  if (role === "admin" || role === "super_admin" || role === "teacher") {
    return (
      <div className="px-6 py-10 md:px-10">
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
            <Link href={role === "teacher" ? "/admin/attendance" : "/admin"} className={cn(stitchButtonClass)}>
              {role === "teacher" ? "Go to Teacher Workspace" : "Go to Command Center"}
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
      <div className="px-6 py-8 md:px-10">
        <StitchSectionHeader
          eyebrow="Student Dashboard"
          title={`Welcome,\n${userName.split(" ")[0]}.`}
          description="Your account is active, but class access is waiting for admin assignment."
        />

        <div className={stitchPanelClass}>
          <h2 className="text-4xl text-foreground">Assignment Pending</h2>
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

  const leadCourse = enrolledCourses[0];

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Student Dashboard"
        title={`Welcome back,\n${userName.split(" ")[0]}.`}
        description={
          isOnlineStudent
            ? "Track your purchased class access, syllabus, and published study materials from one place."
            : "Track your class details, attendance, syllabus, and published study materials from one place."
        }
      />

      {/* ── Bento stat grid — 2-col even on mobile ── */}
      <div className={`mt-8 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 ${isOnlineStudent ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        <Link href="/dashboard/class" className={cn(stitchPanelClass, "col-span-2 sm:col-span-1 transition hover:border-primary/12")}>
          <p className="stitch-kicker">Class Details</p>
          <h2 className="mt-4 text-2xl sm:text-3xl text-foreground">
            {studentRecord?.class?.name ?? "Not Assigned"}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
            {studentRecord?.class?.board ?? "Board pending"} · Level{" "}
            {studentRecord?.class?.level ?? "-"}
          </p>
        </Link>
        {isOnlineStudent ? null : (
          <Link href="/dashboard/attendance" className={cn(stitchPanelClass, "transition hover:border-primary/12")}>
            <p className="stitch-kicker">Attendance</p>
            <p className="mt-4 font-heading text-4xl sm:text-5xl text-primary">
              {stats.attendanceRate}%
            </p>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">View archive</p>
          </Link>
        )}
        <Link href="/dashboard/materials" className={cn(stitchPanelClass, "transition hover:border-primary/12")}>
          <p className="stitch-kicker">Materials</p>
          <p className="mt-4 font-heading text-4xl sm:text-5xl text-foreground">{stats.materials}</p>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Published resources</p>
        </Link>
        <Link href="/dashboard/settings" className={cn(stitchPanelClass, "transition hover:border-primary/12")}>
          <p className="stitch-kicker">Notifications</p>
          <p className="mt-4 font-heading text-4xl sm:text-5xl text-foreground">{stats.notifications}</p>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Profile & account</p>
        </Link>
      </div>

      {/* ── Current Studies + Quick Access — side by side on mobile too ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className={cn(stitchPanelClass, "col-span-2 xl:col-span-1")}>
          <p className="stitch-kicker">Current Studies</p>
          <h2 className="mt-4 text-2xl sm:text-4xl text-foreground">
            {leadCourse?.title ?? (isOnlineStudent ? "No active course assigned" : "No active subject assigned")}
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground">
            {leadCourse?.subject ??
              (isOnlineStudent
                ? "Your active courses will appear here once enrollment is available."
                : "Your active subjects will appear here once class assignment is available.")}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:gap-3 sm:flex-row">
            <Link href="/dashboard/syllabus" className={stitchButtonClass}>
              View Syllabus
            </Link>
            <Link href="/dashboard/class" className={stitchSecondaryButtonClass}>
              Check Class Details
            </Link>
          </div>
        </div>

        {/* Quick Access — 2x2 icon grid on mobile, list on xl */}
        <div className={cn(stitchPanelClass, "col-span-2 xl:col-span-1")}>
          <p className="stitch-kicker">Quick Access</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-1">
            {isOnlineStudent ? null : (
              <Link
                href="/dashboard/attendance"
                className={cn(stitchPanelSoftClass, "flex flex-col items-center gap-2 py-4 text-center xl:flex-row xl:justify-between xl:text-left xl:py-3 transition hover:border-primary/12")}
              >
                <span className="flex flex-col items-center gap-1.5 xl:flex-row xl:gap-3 text-foreground text-xs sm:text-sm">
                  <CalendarCheck className="h-5 w-5 xl:h-4 xl:w-4 text-primary" />
                  Attendance
                </span>
                <ChevronRight className="hidden xl:block h-4 w-4 text-primary" />
              </Link>
            )}
            <Link
              href="/dashboard/materials"
              className={cn(stitchPanelSoftClass, "flex flex-col items-center gap-2 py-4 text-center xl:flex-row xl:justify-between xl:text-left xl:py-3 transition hover:border-primary/12")}
            >
              <span className="flex flex-col items-center gap-1.5 xl:flex-row xl:gap-3 text-foreground text-xs sm:text-sm">
                <FileText className="h-5 w-5 xl:h-4 xl:w-4 text-primary" />
                Materials
              </span>
              <ChevronRight className="hidden xl:block h-4 w-4 text-primary" />
            </Link>
            <Link
              href="/dashboard/syllabus"
              className={cn(stitchPanelSoftClass, "flex flex-col items-center gap-2 py-4 text-center xl:flex-row xl:justify-between xl:text-left xl:py-3 transition hover:border-primary/12")}
            >
              <span className="flex flex-col items-center gap-1.5 xl:flex-row xl:gap-3 text-foreground text-xs sm:text-sm">
                <BookOpen className="h-5 w-5 xl:h-4 xl:w-4 text-primary" />
                Curriculum
              </span>
              <ChevronRight className="hidden xl:block h-4 w-4 text-primary" />
            </Link>
            <Link
              href="/dashboard/settings"
              className={cn(stitchPanelSoftClass, "flex flex-col items-center gap-2 py-4 text-center xl:flex-row xl:justify-between xl:text-left xl:py-3 transition hover:border-primary/12")}
            >
              <span className="flex flex-col items-center gap-1.5 xl:flex-row xl:gap-3 text-foreground text-xs sm:text-sm">
                <Bell className="h-5 w-5 xl:h-4 xl:w-4 text-primary" />
                Settings
              </span>
              <ChevronRight className="hidden xl:block h-4 w-4 text-primary" />
            </Link>
          </div>
        </div>
      </div>


      {/* ── Bottom section — 2-col on mobile for side-by-side feel ── */}
      <div className={`mt-6 grid grid-cols-1 gap-3 sm:gap-6 ${isOnlineStudent ? "xl:grid-cols-1" : "md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_380px]"}`}>
        <div className={stitchPanelClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl text-foreground">Recent Materials</h3>
            <Link
              href="/dashboard/materials"
              className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Open Library
            </Link>
          </div>
          <div className="mt-6 space-y-3">
            {recentMaterials.length === 0 ? (
              <div className={stitchPanelSoftClass}>
                <p className="text-sm text-muted-foreground">
                  {isOnlineStudent
                    ? "No published materials are available for your purchased courses yet."
                    : "No published materials yet for your class."}
                </p>
              </div>
            ) : (
              recentMaterials.map((material) => (
                <Link
                  key={material.id}
                  href="/dashboard/materials"
                  className={cn(
                    stitchPanelSoftClass,
                    "flex items-center justify-between gap-4 transition hover:border-primary/12"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/4 text-primary">
                      {material.type === "link" ? (
                        <ExternalLink className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-base text-foreground">{material.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {material.type}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary" />
                </Link>
              ))
            )}
          </div>
        </div>

        {isOnlineStudent ? null : (
          <div className={stitchPanelClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl text-foreground">Recent Attendance</h3>
              <Link
                href="/dashboard/attendance"
                className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
              >
                View Full Log
              </Link>
            </div>
            <div className="mt-6 space-y-3">
              {recentAttendance.length === 0 ? (
                <div className={stitchPanelSoftClass}>
                  <p className="text-sm text-muted-foreground">
                    No attendance records are available yet.
                  </p>
                </div>
              ) : (
                recentAttendance.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(stitchPanelSoftClass, "flex items-center justify-between")}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/3 text-primary">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          {entry.class?.name ?? "Class Session"}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          {new Date(entry.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                        entry.status === "present"
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
