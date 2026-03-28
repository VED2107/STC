"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LibraryBig,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

interface DashboardStats {
  students: number;
  courses: number;
  teachers: number;
  materials: number;
  classes: number;
  attendance: number;
}

interface RegistryRow {
  id: string;
  profile_id: string;
  enrollment_date: string;
  created_at?: string;
  is_active: boolean;
  profile: { full_name: string; phone: string } | null;
  class: { name: string; board: string } | null;
  student_type?: "tuition" | "online";
  enrollments?: Array<{ status: string; course: { title: string } | null }> | null;
  authUser?: { email: string; full_name: string; phone: string } | null;
}

interface TeacherRow {
  id: string;
  name: string;
  subject: string;
  qualification: string;
}

interface CourseRow {
  id: string;
  title: string;
  subject: string;
  class: { name: string; level: string } | null;
}

interface ClassRow {
  id: string;
  name: string;
  board: string;
  level: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [registry, setRegistry] = useState<RegistryRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadDashboard() {
      if (authLoading) {
        return;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      if (role === "teacher") {
        router.push("/admin/attendance");
        return;
      }

      if (role !== "admin") {
        router.push("/dashboard");
        return;
      }

      const [
        studentCount,
        courseCount,
        teacherCount,
        materialCount,
        classCount,
        attendanceCount,
        registryRes,
        teachersRes,
        coursesRes,
        classesRes,
        authUsersRes,
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("materials").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }),
        supabase
          .from("students")
          .select(
            "id, profile_id, enrollment_date, created_at, is_active, student_type, profile:profiles(full_name, phone), class:classes(name, board), enrollments(status, course:courses(title))",
          )
          .order("created_at", { ascending: false })
          .order("enrollment_date", { ascending: false })
          .limit(5),
        supabase
          .from("teachers")
          .select("id, name, subject, qualification")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("courses")
          .select("id, title, subject, class:classes(name, level)")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("classes")
          .select("id, name, board, level")
          .order("created_at", { ascending: false })
          .limit(4),
        fetch("/api/admin/auth-users", { cache: "no-store" }).then(async (response) =>
          response.ok ? response.json() : { users: [] },
        ),
      ]);

      if (cancelled) {
        return;
      }

      const authFallbackById = new Map(
        (((authUsersRes as { users?: Array<{ id: string; email: string; full_name: string; phone: string }> }).users) ?? []).map(
          (entry) => [
            entry.id,
            {
              email: entry.email,
              full_name: entry.full_name,
              phone: entry.phone,
            },
          ],
        ),
      );

      setStats({
        students: studentCount.count ?? 0,
        courses: courseCount.count ?? 0,
        teachers: teacherCount.count ?? 0,
        materials: materialCount.count ?? 0,
        classes: classCount.count ?? 0,
        attendance: attendanceCount.count ?? 0,
      });
      setRegistry(
        (((registryRes.data as RegistryRow[] | null) ?? []).map((row) => ({
          ...row,
          authUser: authFallbackById.get(row.profile_id) ?? null,
        }))),
      );
      setTeachers((teachersRes.data as TeacherRow[] | null) ?? []);
      setCourses((coursesRes.data as CourseRow[] | null) ?? []);
      setClasses((classesRes.data as ClassRow[] | null) ?? []);
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authLoading, role, router, user]);

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const summaryCardClass = cn(
    stitchPanelSoftClass,
    "group relative overflow-hidden border-white/70 bg-white/78 backdrop-blur-xl shadow-[0_18px_40px_-28px_rgba(26,28,29,0.22)] transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/92 hover:shadow-[0_24px_52px_-28px_rgba(26,28,29,0.26)]"
  );
  const linkedPanelClass = cn(
    stitchPanelSoftClass,
    "group relative overflow-hidden border-white/70 bg-white/78 backdrop-blur-xl shadow-[0_18px_40px_-28px_rgba(26,28,29,0.18)] transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/92 hover:shadow-[0_24px_52px_-28px_rgba(26,28,29,0.24)]"
  );

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="flex flex-col gap-5 border-b border-black/[0.06] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-heading text-3xl italic text-primary">Admin Command Center</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Review everything you have added across teachers, classes, courses, students, materials, and attendance.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/admin/teachers" className={stitchSecondaryButtonClass}>
            Add Teacher
          </Link>
          <Link href="/admin/students" className={stitchButtonClass}>
            Add Student
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{stats.students}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Live registry count
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Teachers</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{stats.teachers}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Active faculty records
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Courses</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{stats.courses}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Published curriculum units
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Attendance Records</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{stats.attendance}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Total saved sessions
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <div className={stitchPanelClass}>
          <div className="flex flex-col gap-4 border-b border-black/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-5xl italic text-primary">Recently Added Students</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Student registry entries created through the admin workspace.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/admin/students" className={stitchSecondaryButtonClass}>
                Manage Students
              </Link>
              <Link href="/admin/classes" className={stitchButtonClass}>
                Manage Classes
              </Link>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <tr>
                  <th className="pb-4 font-medium">Participant</th>
                  <th className="pb-4 font-medium">Class</th>
                  <th className="pb-4 font-medium">Course Access</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {registry.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-sm text-muted-foreground">
                      No students added yet.
                    </td>
                  </tr>
                ) : (
                  registry.map((row) => (
                    <tr key={row.id}>
                      <td className="py-4">
                        <p className="text-base text-foreground">
                          {row.profile?.full_name || row.authUser?.full_name || row.authUser?.email || "Unnamed Scholar"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.profile?.phone || row.authUser?.phone || row.authUser?.email || "No contact"}
                        </p>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {row.class?.name ?? "Independent Study"}
                        <div className="mt-1 text-xs text-muted-foreground">{row.class?.board ?? "STC"}</div>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {row.student_type === "online"
                          ? (row.enrollments ?? [])
                              .filter((entry) => entry.status === "active")
                              .map((entry) => entry.course?.title)
                              .filter((value): value is string => Boolean(value))
                              .join(", ") || "No purchased course"
                          : "Class resources"}
                      </td>
                      <td className="py-4">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs",
                            row.is_active ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {new Date(row.enrollment_date).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6">
          <div className={stitchPanelClass}>
            <p className="stitch-kicker">What You Added</p>
            <div className="mt-5 grid gap-3">
              <Link href="/admin/teachers" className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Teachers
                </span>
                <span className="text-sm font-semibold text-primary">{stats.teachers}</span>
              </Link>
              <Link href="/admin/classes" className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <LibraryBig className="h-4 w-4 text-primary" />
                  Classes
                </span>
                <span className="text-sm font-semibold text-primary">{stats.classes}</span>
              </Link>
              <Link href="/admin/courses" className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Courses
                </span>
                <span className="text-sm font-semibold text-primary">{stats.courses}</span>
              </Link>
              <Link href="/admin/materials" className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Materials
                </span>
                <span className="text-sm font-semibold text-primary">{stats.materials}</span>
              </Link>
              <Link href="/admin/attendance" className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Attendance
                </span>
                <span className="text-sm font-semibold text-primary">{stats.attendance}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        <div className={stitchPanelClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl italic text-primary">Latest Teachers</h3>
            <Link href="/admin/teachers" className="text-xs uppercase tracking-[0.2em] text-secondary">
              Manage
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teachers created yet.</p>
            ) : (
              teachers.map((teacher) => (
                <div key={teacher.id} className={stitchPanelSoftClass}>
                  <p className="text-base text-foreground">{teacher.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {teacher.subject} · {teacher.qualification}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={stitchPanelClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl italic text-primary">Latest Courses</h3>
            <Link href="/admin/courses" className="text-xs uppercase tracking-[0.2em] text-secondary">
              Manage
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses created yet.</p>
            ) : (
              courses.map((course) => (
                <div key={course.id} className={stitchPanelSoftClass}>
                  <p className="text-base text-foreground">{course.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {course.subject} · {course.class?.name ?? course.class?.level ?? "Independent"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={stitchPanelClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-3xl italic text-primary">Latest Classes</h3>
            <Link href="/admin/classes" className="text-xs uppercase tracking-[0.2em] text-secondary">
              Manage
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes created yet.</p>
            ) : (
              classes.map((item) => (
                <div key={item.id} className={stitchPanelSoftClass}>
                  <p className="text-base text-foreground">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.board} · Level {item.level}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
