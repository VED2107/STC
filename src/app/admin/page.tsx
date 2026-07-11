import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  IndianRupee,
  LibraryBig,
  PackageOpen,
  Users,
} from "lucide-react";
import { AdminNukeButton } from "@/components/admin/admin-nuke-button";

import {
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { createClient } from "@/lib/supabase/server";
import { getAdminAuth } from "@/lib/auth/admin-auth";
import { cn } from "@/lib/utils";
import { getFeesStatusLabel, hasFullPaymentMarked, isFullyPaid, isPartiallyPaid } from "@/lib/student-fees";

interface DashboardStats {
  students: number;
  courses: number;
  teachers: number;
  materials: number;
  classes: number;
  attendance: number;
  feesPaid: number;
  feesPartial: number;
  feesNotPaid: number;
}

interface RegistryRow {
  id: string;
  profile_id: string;
  enrollment_date: string;
  created_at?: string;
  is_active: boolean;
  fees_amount: number;
  fees_full_payment_paid: boolean;
  fees_installment1_paid: boolean;
  fees_installment2_paid: boolean;
  profile: { full_name: string; phone: string } | null;
  class: { name: string; board: string } | null;
  student_type?: "tuition" | "online";
  enrollments?: Array<{ status: string; course: { title: string } | null }> | null;
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

export default async function AdminDashboard() {
  // Deduped per-request — reuses the getUser()+profile fetch already done by
  // the admin layout instead of issuing a second auth round-trip.
  const auth = await getAdminAuth();

  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "teacher") {
    redirect("/admin/attendance");
  }

  if (auth.role !== "admin" && auth.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [
    statsRes,
    registryRes,
    teachersRes,
    coursesRes,
    classesRes,
  ] = await Promise.all([
    supabase.rpc("get_admin_dashboard_stats"),
    supabase
      .from("students")
      .select(
        "id, profile_id, enrollment_date, created_at, is_active, student_type, fees_amount, fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid, profile:profiles(full_name, phone), class:classes(name, board), enrollments(status, course:courses(title))",
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
  ]);

  const dbStats = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
  const registry = (registryRes.data as RegistryRow[] | null) ?? [];
  const teachers = (teachersRes.data as TeacherRow[] | null) ?? [];
  const courses = (coursesRes.data as CourseRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];

  const stats: DashboardStats = {
    students: Number(dbStats?.student_count ?? 0),
    courses: Number(dbStats?.course_count ?? 0),
    teachers: Number(dbStats?.teacher_count ?? 0),
    materials: Number(dbStats?.material_count ?? 0),
    classes: Number(dbStats?.class_count ?? 0),
    attendance: Number(dbStats?.attendance_count ?? 0),
    feesPaid: Number(dbStats?.fees_paid ?? 0),
    feesPartial: Number(dbStats?.fees_partial ?? 0),
    feesNotPaid: Number(dbStats?.fees_not_paid ?? 0),
  };

  const isSuperAdmin = auth.role === "super_admin";

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
      <div className="flex flex-col gap-5 border-b border-black/6 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-heading text-3xl italic text-primary">Admin Command Center</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Review everything you have added across teachers, classes, subjects, students, materials, and attendance.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <AdminNukeButton isAllowed={isSuperAdmin} />
          <Link href="/admin/teachers" className={stitchSecondaryButtonClass}>
            Add Teacher
          </Link>
          <Link href="/admin/students" className={stitchButtonClass}>
            Add Student
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
        {[
          { label: "Students", value: stats.students, icon: Users, accent: "bg-[#d0e9d4]/55 text-[#374c3d]", gradient: "from-[#d0e9d4]/20", desc: "Active institutional profiles" },
          { label: "Subjects", value: stats.courses, icon: BookOpen, accent: "bg-[#eef2ff] text-[#3651a5]", gradient: "from-[#eef2ff]/30", desc: "Published curriculum entries" },
          { label: "Attendance", value: stats.attendance, icon: CalendarCheck, accent: "bg-[#fff2dc] text-[#9a6500]", gradient: "from-[#fff2dc]/30", desc: "Recorded daily logs" },
          { label: "Materials", value: stats.materials, icon: PackageOpen, accent: "bg-[#f1edff] text-[#6a4bc4]", gradient: "from-[#f1edff]/30", desc: "Published learning assets" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={summaryCardClass}>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.gradient} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="stitch-kicker">{stat.label}</p>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.accent} transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-4 font-heading text-5xl text-foreground">{stat.value}</p>
                <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
                  {stat.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className={stitchPanelClass}>
          <div className="flex flex-col gap-3 border-b border-black/6 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="stitch-kicker">Recent Registry</p>
              <h2 className="mt-2 text-3xl italic text-primary">Latest Students</h2>
            </div>
            <Link href="/admin/students" className="text-xs uppercase tracking-[0.2em] text-secondary">
              View Registry
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Student</th>
                  <th className="pb-2 pr-4 font-medium">Program</th>
                  <th className="pb-2 pr-4 font-medium">Fee Status</th>
                  <th className="pb-2 font-medium">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {registry.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="rounded-3xl border border-dashed border-black/8 px-4 py-10 text-center text-sm text-muted-foreground">
                      No student entries found yet.
                    </td>
                  </tr>
                ) : (
                  registry.map((row) => (
                    <tr key={row.id} className="rounded-[26px] bg-white/85 shadow-[0_16px_32px_-28px_rgba(26,28,29,0.28)]">
                      <td className="rounded-l-[26px] px-4 py-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{row.profile?.full_name ?? "Unnamed student"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.profile?.phone ?? "No phone added"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{row.class?.name ?? "Assignment Pending"}</p>
                          <p>{row.class?.board ?? row.student_type ?? "No program selected"}</p>
                          {row.enrollments?.[0]?.course?.title ? (
                            <p className="text-xs text-secondary">{row.enrollments[0].course.title}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                            isFullyPaid(row)
                              ? "bg-green-100 text-green-700"
                              : isPartiallyPaid(row)
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700",
                          )}
                        >
                          {getFeesStatusLabel(row)}
                        </span>
                        {hasFullPaymentMarked(row) ? (
                          <p className="mt-1 text-xs text-green-700">One-shot payment</p>
                        ) : null}
                        {(row.fees_amount ?? 0) > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">₹{row.fees_amount.toLocaleString("en-IN")}</p>
                        )}
                      </td>
                      <td className="rounded-r-[26px] py-4 text-sm text-muted-foreground">
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
              <Link href="/admin/subjects" className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Subjects
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

          <div className={stitchPanelClass}>
            <p className="stitch-kicker">Fee Snapshot</p>
            <div className="mt-5 grid gap-3">
              <div className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <IndianRupee className="h-4 w-4 text-green-600" />
                  Fully Paid
                </span>
                <span className="text-sm font-semibold text-green-700">{stats.feesPaid}</span>
              </div>
              <div className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <IndianRupee className="h-4 w-4 text-amber-600" />
                  Partially Paid
                </span>
                <span className="text-sm font-semibold text-amber-700">{stats.feesPartial}</span>
              </div>
              <div className={cn(linkedPanelClass, "flex items-center justify-between")}>
                <span className="flex items-center gap-3 text-foreground">
                  <IndianRupee className="h-4 w-4 text-rose-600" />
                  Not Paid
                </span>
                <span className="text-sm font-semibold text-rose-700">{stats.feesNotPaid}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-6 xl:grid-cols-3">
        <div className={cn(stitchPanelClass, "col-span-2 xl:col-span-1")}>
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
            <h3 className="text-3xl italic text-primary">Latest Subjects</h3>
            <Link href="/admin/subjects" className="text-xs uppercase tracking-[0.2em] text-secondary">
              Manage
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects created yet.</p>
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

        <div className={cn(stitchPanelClass, "col-span-2 sm:col-span-1")}>
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
