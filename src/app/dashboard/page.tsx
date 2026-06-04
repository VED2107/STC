"use client";

import { Suspense, useEffect, useState } from "react";
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
  PlayCircle,
  QrCode,
  StickyNote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { getCached, setCache } from "@/lib/dashboard-cache";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
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

      setUserName(profile?.full_name || user.user_metadata?.full_name || user.email || "Scholar");

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

  const summaryCardClass = cn(
    stitchPanelSoftClass,
    "group relative overflow-hidden border-white/70 bg-white/78 backdrop-blur-xl shadow-[0_18px_40px_-28px_rgba(26,28,29,0.22)] transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/92 hover:shadow-[0_24px_52px_-28px_rgba(26,28,29,0.26)]"
  );

  const materialIconMap: Record<string, { icon: typeof FileText; accent: string }> = {
    pdf: { icon: FileText, accent: "bg-[#fce4ec] text-[#c62828]" },
    video: { icon: PlayCircle, accent: "bg-[#e8f5e9] text-[#2e7d32]" },
    notes: { icon: StickyNote, accent: "bg-[#eef2ff] text-[#3651a5]" },
    link: { icon: ExternalLink, accent: "bg-[#fff2dc] text-[#9a6500]" },
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
      <div className="px-6 py-10 md:px-10">
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
        <WelcomeGreeting name={userName} isNewUser />
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
  const renderMaterialLink = (material: MaterialRow) => {
    const matMeta = materialIconMap[material.type] ?? materialIconMap.notes;
    const MatIcon = matMeta.icon;

    return (
      <Link
        key={material.id}
        href="/dashboard/materials"
        className={cn(
          stitchPanelSoftClass,
          "flex items-center justify-between gap-4 transition hover:border-primary/12"
        )}
      >
        <div className="flex items-center gap-4">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", matMeta.accent)}>
            <MatIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-base text-foreground">{material.title}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {material.type}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-primary" />
      </Link>
    );
  };
  const renderAttendanceRow = (entry: AttendanceRow) => {
    const entryName = entry.class?.name ?? "Class Session";
    const hue = (entryName.charCodeAt(0) * 7) % 360;

    return (
      <div
        key={entry.id}
        className={cn(stitchPanelSoftClass, "flex items-center justify-between")}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: `hsl(${hue}, 45%, 92%)`, color: `hsl(${hue}, 40%, 45%)` }}
          >
            {entryName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm text-foreground">{entryName}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {new Date(entry.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              entry.status === "present" ? "bg-primary" : "bg-destructive"
            }`}
          />
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
      </div>
    );
  };

  return (
    <div className="px-6 py-8 md:px-10">
      <WelcomeGreeting name={userName} />
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
        <Link href="/dashboard/class" className={cn(summaryCardClass, "col-span-2 sm:col-span-1")}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#eef2ff]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <div className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3651a5] transition-transform duration-300 group-hover:scale-110">
              <GraduationCap className="h-5 w-5" />
            </span>
            <p className="stitch-kicker mt-4">Class Details</p>
            <h2 className="mt-2 text-2xl sm:text-3xl text-foreground">
              {studentRecord?.class?.name ?? "Not Assigned"}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
              {studentRecord?.class?.board ?? "Board pending"} · Level{" "}
              {studentRecord?.class?.level ?? "-"}
              {studentRecord?.branch ? ` · ${studentRecord.branch.name}` : ""}
            </p>
          </div>
        </Link>
        {isOnlineStudent ? null : (
          <Link href="/dashboard/attendance" className={cn(summaryCardClass)}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fff2dc]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
            <div className="relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff2dc] text-[#9a6500] transition-transform duration-300 group-hover:scale-110">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <p className="stitch-kicker mt-4">Attendance</p>
              <p className="mt-2 font-heading text-4xl sm:text-5xl text-primary">
                {stats.attendanceRate}%
              </p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-black/5">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stats.attendanceRate}%` }} />
              </div>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground">View archive</p>
            </div>
          </Link>
        )}
        <Link href="/dashboard/materials" className={cn(summaryCardClass)}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#f1edff]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <div className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1edff] text-[#6a4bc4] transition-transform duration-300 group-hover:scale-110">
              <FileText className="h-5 w-5" />
            </span>
            <p className="stitch-kicker mt-4">Materials</p>
            <p className="mt-2 font-heading text-4xl sm:text-5xl text-foreground">{stats.materials}</p>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Published resources</p>
          </div>
        </Link>
        <Link href="/dashboard/settings" className={cn(summaryCardClass)}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fce4ec]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <div className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fce4ec] text-[#c62828] transition-transform duration-300 group-hover:scale-110">
              <Bell className="h-5 w-5" />
            </span>
            <p className="stitch-kicker mt-4">Notifications</p>
            <p className="mt-2 font-heading text-4xl sm:text-5xl text-foreground">{stats.notifications}</p>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Profile & account</p>
          </div>
        </Link>
      </div>

      {/* ── Current Studies + Quick Access — side by side on mobile too ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className={cn(stitchPanelClass, "col-span-2 xl:col-span-1")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3651a5]">
            <BookOpen className="h-5 w-5" />
          </span>
          <p className="stitch-kicker mt-4">Current Studies</p>
          <h2 className="mt-2 text-2xl sm:text-4xl text-foreground">
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
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff2dc] text-[#9a6500]">
                    <CalendarCheck className="h-4 w-4" />
                  </span>
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
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1edff] text-[#6a4bc4]">
                  <FileText className="h-4 w-4" />
                </span>
                Materials
              </span>
              <ChevronRight className="hidden xl:block h-4 w-4 text-primary" />
            </Link>
            <Link
              href="/dashboard/syllabus"
              className={cn(stitchPanelSoftClass, "flex flex-col items-center gap-2 py-4 text-center xl:flex-row xl:justify-between xl:text-left xl:py-3 transition hover:border-primary/12")}
            >
              <span className="flex flex-col items-center gap-1.5 xl:flex-row xl:gap-3 text-foreground text-xs sm:text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3651a5]">
                  <BookOpen className="h-4 w-4" />
                </span>
                Curriculum
              </span>
              <ChevronRight className="hidden xl:block h-4 w-4 text-primary" />
            </Link>
            <Link
              href="/dashboard/settings"
              className={cn(stitchPanelSoftClass, "flex flex-col items-center gap-2 py-4 text-center xl:flex-row xl:justify-between xl:text-left xl:py-3 transition hover:border-primary/12")}
            >
              <span className="flex flex-col items-center gap-1.5 xl:flex-row xl:gap-3 text-foreground text-xs sm:text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fce4ec] text-[#c62828]">
                  <Bell className="h-4 w-4" />
                </span>
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
              recentMaterials.map(renderMaterialLink)
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
                recentAttendance.map(renderAttendanceRow)
              )}
            </div>
          </div>
        )}
      </div>
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
