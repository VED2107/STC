import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarCheck, FolderOpen, GraduationCap, LibraryBig, Plus, ScanLine, Users, type LucideIcon } from "lucide-react";
import { AdminNukeButton } from "@/components/admin/admin-nuke-button";
import { TeacherHome } from "@/components/admin/teacher-home";
import { Badge } from "@/components/ui/badge";
import { stitchButtonClass, stitchOutlineButtonClass } from "@/components/stitch/primitives";
import { createClient } from "@/lib/supabase/server";
import { getAdminAuth } from "@/lib/auth/admin-auth";
import { getFeesStatusLabel, hasFullPaymentMarked, isFullyPaid, isPartiallyPaid } from "@/lib/student-fees";

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

interface ClassRow {
  id: string;
  name: string;
  board: string;
  level: string;
}

interface LowAttendanceRow {
  student_id: string;
  student_name: string;
  class_name: string;
  attendance_rate: number;
}

interface TrendRow {
  month_label: string;
  attendance_rate: number;
  total_records: number;
}

function CountLink({ href, label, value, icon: Icon }: { href: string; label: string; value: number; icon: LucideIcon }) {
  return (
    <Link href={href} className="stitch-panel stitch-hover-lift block p-4 md:p-5">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </span>
      <span className="tnum mt-2 block font-heading text-3xl font-semibold text-primary md:text-4xl">
        {value.toLocaleString("en-IN")}
      </span>
    </Link>
  );
}

function FeeBar({ paid, partial, unpaid }: { paid: number; partial: number; unpaid: number }) {
  const total = paid + partial + unpaid;
  const rows = [
    { label: "Fully paid", value: paid, bar: "bg-success", ink: "text-success" },
    { label: "Part paid", value: partial, bar: "bg-accent", ink: "text-warning" },
    { label: "Not paid", value: unpaid, bar: "bg-destructive", ink: "text-destructive" },
  ];

  if (total === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">Fee status appears once students are added.</p>;
  }

  return (
    <>
      <div
        role="img"
        aria-label={`${paid} fully paid, ${partial} part paid, ${unpaid} not paid`}
        className="grow-x mt-4 flex h-3 gap-0.5 overflow-hidden rounded-sm"
      >
        {rows.map((row) =>
          row.value > 0 ? <span key={row.label} className={row.bar} style={{ width: `${(row.value / total) * 100}%` }} /> : null,
        )}
      </div>
      <dl className="mt-4 grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span aria-hidden="true" className={`size-2.5 rounded-[2px] ${row.bar}`} />
              {row.label}
            </dt>
            <dd className={`tnum font-semibold ${row.ink}`}>{row.value.toLocaleString("en-IN")}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export default async function AdminDashboard() {
  // Deduped per-request: reuses the getUser() + profile fetch from the admin layout.
  const auth = await getAdminAuth();

  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "teacher") {
    return <TeacherHome userId={auth.userId} fullName={auth.fullName} />;
  }

  if (auth.role !== "admin" && auth.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  // These report functions exist in the database but not in the generated client types.
  const reports = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [statsRes, registryRes, teachersRes, classesRes, lowRes, trendRes] = await Promise.all([
    supabase.rpc("get_admin_dashboard_stats"),
    supabase
      .from("students")
      .select(
        "id, profile_id, enrollment_date, created_at, is_active, student_type, fees_amount, fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid, profile:profiles(full_name, phone), class:classes(name, board), enrollments(status, course:courses(title))",
      )
      .order("created_at", { ascending: false })
      .order("enrollment_date", { ascending: false })
      .limit(6),
    supabase.from("teachers").select("id, name, subject, qualification").order("created_at", { ascending: false }).limit(4),
    supabase.from("classes").select("id, name, board, level").order("created_at", { ascending: false }).limit(4),
    reports.rpc("get_low_attendance_students", {
      p_threshold: 75,
      p_date_from: monthAgo.toISOString().slice(0, 10),
      p_date_to: today.toISOString().slice(0, 10),
    }),
    reports.rpc("get_monthly_attendance_trend", { p_months: 6 }),
  ]);

  const dbStats = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
  const registry = (registryRes.data as RegistryRow[] | null) ?? [];
  const teachers = (teachersRes.data as TeacherRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const loadFailed = Boolean(statsRes.error || registryRes.error);
  const lowAttendance = ((lowRes.data as LowAttendanceRow[] | null) ?? []).slice(0, 5);
  const trend = ((trendRes.data as TrendRow[] | null) ?? []).slice(-6);

  const stats = {
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

  const firstName = (auth.fullName ?? "").split(" ")[0];

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl text-primary md:text-4xl">{firstName ? `Hello, ${firstName}` : "Dashboard"}</h1>
          <p className="mt-1 text-muted-foreground">Students, fees, and attendance across STC Academy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/qr-scan" className={stitchOutlineButtonClass}>
            <ScanLine aria-hidden="true" className="size-4" />
            Scan attendance
          </Link>
          <Link href="/admin/students?create=1" className={stitchButtonClass}>
            <Plus aria-hidden="true" className="size-4" />
            Add student
          </Link>
        </div>
      </div>

      {loadFailed ? (
        <p role="alert" className="mt-6 rounded-xl bg-danger-soft p-4 text-sm text-destructive">
          Some dashboard numbers could not be loaded, so counts may show 0. Refresh the page to try again.
        </p>
      ) : null}

      <div className="rise-in mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CountLink href="/admin/students" label="Students" value={stats.students} icon={Users} />
        <CountLink href="/admin/teachers" label="Teachers" value={stats.teachers} icon={GraduationCap} />
        <CountLink href="/admin/classes" label="Classes" value={stats.classes} icon={LibraryBig} />
        <CountLink href="/admin/subjects" label="Subjects" value={stats.courses} icon={BookOpen} />
        <CountLink href="/admin/materials" label="Materials" value={stats.materials} icon={FolderOpen} />
        <CountLink href="/admin/attendance" label="Attendance marks" value={stats.attendance} icon={CalendarCheck} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <section aria-labelledby="latest-students" className="stitch-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <h2 id="latest-students" className="text-xl text-primary">Latest students</h2>
            <Link href="/admin/students" className="text-sm font-semibold text-secondary hover:underline">
              All students
            </Link>
          </div>

          {registry.length === 0 ? (
            <div className="border-t px-5 py-10 text-center">
              <p className="text-muted-foreground">No students yet. Add the first one to start the register.</p>
              <Link href="/admin/students?create=1" className={`${stitchButtonClass} mt-4`}>
                Add student
              </Link>
            </div>
          ) : (
            <ul className="divide-y border-t">
              {registry.map((row) => (
                <li key={row.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_10rem] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{row.profile?.full_name ?? "Unnamed student"}</p>
                    <p className="tnum truncate text-sm text-muted-foreground">{row.profile?.phone ?? "No phone added"}</p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-foreground">{row.class?.name ?? "No class assigned"}</p>
                    <p className="truncate text-muted-foreground">
                      {row.class?.board ?? row.enrollments?.[0]?.course?.title ?? row.student_type ?? "No program selected"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <Badge variant={isFullyPaid(row) ? "success" : isPartiallyPaid(row) ? "warning" : "destructive"}>
                      {getFeesStatusLabel(row)}
                    </Badge>
                    <span className="tnum text-xs text-muted-foreground">
                      {(row.fees_amount ?? 0) > 0 ? `₹${row.fees_amount.toLocaleString("en-IN")}` : ""}
                      {hasFullPaymentMarked(row) ? " one payment" : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="fee-status" className="stitch-panel p-5">
            <h2 id="fee-status" className="text-xl text-primary">Fee status</h2>
            <FeeBar paid={stats.feesPaid} partial={stats.feesPartial} unpaid={stats.feesNotPaid} />
          </section>

          <section aria-labelledby="needs-attention" className="stitch-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="needs-attention" className="text-xl text-primary">Needs attention</h2>
              <Link href="/admin/reports" className="text-sm font-semibold text-secondary hover:underline">Reports</Link>
            </div>
            {lowAttendance.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No student is below 75% attendance in the last 30 days.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lowAttendance.map((row) => (
                  <li key={row.student_id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{row.student_name}</span>
                      <span className="block truncate text-muted-foreground">{row.class_name}</span>
                    </span>
                    <span className="tnum shrink-0 font-semibold text-destructive">{Math.round(Number(row.attendance_rate))}%</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {trend.length > 0 ? (
            <section aria-labelledby="attendance-trend" className="stitch-panel p-5">
              <h2 id="attendance-trend" className="text-xl text-primary">Attendance by month</h2>
              <ul className="mt-4 flex h-28 items-end gap-2">
                {trend.map((row, index) => (
                  <li key={row.month_label} className="flex h-full flex-1 flex-col justify-end gap-1 text-center">
                    <span className="tnum text-xs font-semibold text-foreground">{Math.round(Number(row.attendance_rate))}%</span>
                    <span
                      aria-hidden="true"
                      style={{ height: `${Math.max(4, Number(row.attendance_rate) * 0.7)}%`, "--i": index * 3 } as React.CSSProperties}
                      className="grow-y rounded-t-[3px] bg-accent"
                    />
                    <span className="truncate text-xs text-muted-foreground">{row.month_label.split(" ")[0]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="new-teachers" className="stitch-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="new-teachers" className="text-xl text-primary">Newest teachers</h2>
              <Link href="/admin/teachers" className="text-sm font-semibold text-secondary hover:underline">Manage</Link>
            </div>
            {teachers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No teachers added yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {teachers.map((teacher) => (
                  <li key={teacher.id} className="text-sm">
                    <span className="font-medium text-foreground">{teacher.name}</span>
                    <span className="text-muted-foreground">, {teacher.subject}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="new-classes" className="stitch-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="new-classes" className="text-xl text-primary">Newest classes</h2>
              <Link href="/admin/classes" className="text-sm font-semibold text-secondary hover:underline">Manage</Link>
            </div>
            {classes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No classes added yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {classes.map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="text-muted-foreground">, {item.board}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <AdminNukeButton isAllowed={auth.role === "super_admin"} />
    </div>
  );
}
