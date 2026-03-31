"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  FileText,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

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
}

interface MaterialRow {
  id: string;
  title: string;
  type: "pdf" | "notes" | "video";
}

interface StudentRecord {
  id: string;
  class_id: string;
  student_type: "tuition" | "online";
  class?: { name: string; board: string; level: string } | null;
}

export default function StudentDashboard() {
  const router = useRouter();
  const supabase = createClient();
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
  const isOnlineStudent = studentRecord?.student_type === "online";

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      if (authLoading || cancelled) return;
      if (!user) {
        router.push("/login");
        return;
      }

      setUserName(profile?.full_name || user.user_metadata?.full_name || user.email || "Scholar");

      if (role === "admin" || role === "teacher") {
        setLoading(false);
        return;
      }

      const { data: student } = await supabase
        .from("students")
        .select("id, class_id, student_type, class:classes(name, board, level)")
        .eq("profile_id", user.id)
        .single();

      if (!student || cancelled) {
        setLoading(false);
        return;
      }

      const typedStudent = student as StudentRecord;

      const [attendanceRes, coursesRes, notifsRes, enrollmentsRes] =
        await Promise.all([
          supabase
            .from("attendance")
            .select("id, date, status, class:classes(name)")
            .eq("student_id", typedStudent.id)
            .order("date", { ascending: false })
            .limit(4),
          supabase
            .from("enrollments")
            .select("course:courses(id, title, subject)")
            .eq("student_id", typedStudent.id)
            .eq("status", "active"),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("student_id", typedStudent.id)
            .eq("status", "pending"),
          supabase
            .from("enrollments")
            .select("course_id")
            .eq("student_id", typedStudent.id)
            .eq("status", "active"),
        ]);

      const activeCourseIds = ((enrollmentsRes.data as { course_id: string }[] | null) ?? []).map(
        (entry) => entry.course_id,
      );

      let materialsCount = 0;
      let recentMaterials: MaterialRow[] = [];

      if (typedStudent.student_type === "tuition") {
        const [materialsRes, recentMaterialsRes] = await Promise.all([
          supabase
            .from("materials")
            .select("id", { count: "exact", head: true })
            .eq("class_id", typedStudent.class_id),
          supabase
            .from("materials")
            .select("id, title, type")
            .eq("class_id", typedStudent.class_id)
            .order("created_at", { ascending: false })
            .limit(4),
        ]);
        materialsCount = materialsRes.count ?? 0;
        recentMaterials = (recentMaterialsRes.data as MaterialRow[] | null) ?? [];
      } else if (activeCourseIds.length > 0) {
        const [materialsRes, recentMaterialsRes] = await Promise.all([
          supabase
            .from("materials")
            .select("id", { count: "exact", head: true })
            .in("course_id", activeCourseIds),
          supabase
            .from("materials")
            .select("id, title, type")
            .in("course_id", activeCourseIds)
            .order("created_at", { ascending: false })
            .limit(4),
        ]);
        materialsCount = materialsRes.count ?? 0;
        recentMaterials = (recentMaterialsRes.data as MaterialRow[] | null) ?? [];
      }

      let rate = 0;
      if (typedStudent.student_type === "tuition") {
        const [{ count: totalAtt }, { count: presentAtt }] = await Promise.all([
          supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("student_id", typedStudent.id),
          supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("student_id", typedStudent.id)
            .eq("status", "present"),
        ]);

        rate =
          totalAtt && totalAtt > 0
            ? Math.round(((presentAtt ?? 0) / totalAtt) * 100)
            : 0;
      }

      const courses = (coursesRes.data ?? [])
        .map((entry: { course: unknown }) => entry.course as unknown as CourseRow | null)
        .filter(Boolean) as CourseRow[];

      if (cancelled) return;
      setStudentRecord(typedStudent);
      setRecentAttendance((attendanceRes.data as AttendanceRow[] | null) ?? []);
      setEnrolledCourses(courses);
      setRecentMaterials(recentMaterials);
      setStats({
        courses: courses.length,
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
  }, [authLoading, profile?.full_name, role, router, supabase, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (role === "admin" || role === "teacher") {
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
          <Link href="/admin" className={cn(stitchButtonClass, "mt-8")}>
            Go to Command Center
          </Link>
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

      <div className={`mt-8 grid gap-6 md:grid-cols-2 ${isOnlineStudent ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        <Link href="/dashboard/class" className={cn(stitchPanelClass, "transition hover:border-primary/12")}>
          <p className="stitch-kicker">Class Details</p>
          <h2 className="mt-5 text-3xl text-foreground">
            {studentRecord?.class?.name ?? "Not Assigned"}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {studentRecord?.class?.board ?? "Board pending"} · Level{" "}
            {studentRecord?.class?.level ?? "-"}
          </p>
        </Link>
        {isOnlineStudent ? null : (
          <Link href="/dashboard/attendance" className={cn(stitchPanelClass, "transition hover:border-primary/12")}>
            <p className="stitch-kicker">Attendance</p>
            <p className="mt-5 font-heading text-5xl text-primary">
              {stats.attendanceRate}%
            </p>
            <p className="mt-3 text-sm text-muted-foreground">View your attendance archive</p>
          </Link>
        )}
        <Link href="/dashboard/materials" className={cn(stitchPanelClass, "transition hover:border-primary/12")}>
          <p className="stitch-kicker">Materials</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{stats.materials}</p>
          <p className="mt-3 text-sm text-muted-foreground">Published resources for your class</p>
        </Link>
        <Link href="/dashboard/settings" className={cn(stitchPanelClass, "transition hover:border-primary/12")}>
          <p className="stitch-kicker">Notifications</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{stats.notifications}</p>
          <p className="mt-3 text-sm text-muted-foreground">Review profile and account details</p>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className={stitchPanelClass}>
          <p className="stitch-kicker">Current Studies</p>
          <h2 className="mt-4 text-4xl text-foreground">
            {leadCourse?.title ?? "No active course assigned"}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {leadCourse?.subject ??
              "Your active courses will appear here once enrollment is available."}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard/syllabus" className={stitchButtonClass}>
              View Syllabus
            </Link>
            <Link href="/dashboard/class" className={stitchSecondaryButtonClass}>
              Check Class Details
            </Link>
          </div>
        </div>

        <div className={stitchPanelClass}>
          <p className="stitch-kicker">Quick Access</p>
          <div className="mt-6 grid gap-3">
            {isOnlineStudent ? null : (
              <Link
                href="/dashboard/attendance"
                className={cn(stitchPanelSoftClass, "flex items-center justify-between transition hover:border-primary/12")}
              >
                <span className="flex items-center gap-3 text-foreground">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  Attendance History
                </span>
                <ChevronRight className="h-4 w-4 text-primary" />
              </Link>
            )}
            <Link
              href="/dashboard/materials"
              className={cn(stitchPanelSoftClass, "flex items-center justify-between transition hover:border-primary/12")}
            >
              <span className="flex items-center gap-3 text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Study Materials
              </span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </Link>
            <Link
              href="/dashboard/syllabus"
              className={cn(stitchPanelSoftClass, "flex items-center justify-between transition hover:border-primary/12")}
            >
              <span className="flex items-center gap-3 text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                Curriculum Outline
              </span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </Link>
            <Link
              href="/dashboard/settings"
              className={cn(stitchPanelSoftClass, "flex items-center justify-between transition hover:border-primary/12")}
            >
              <span className="flex items-center gap-3 text-foreground">
                <Bell className="h-4 w-4 text-primary" />
                Profile & Settings
              </span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </Link>
          </div>
        </div>
      </div>

      <div className={`mt-8 grid gap-6 ${isOnlineStudent ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_380px]"}`}>
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
                      <FileText className="h-5 w-5" />
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
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.03] text-primary">
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
