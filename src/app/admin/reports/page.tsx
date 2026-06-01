"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Download,
  TrendingDown,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StitchSectionHeader,
  stitchButtonClass,
  stitchInputClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { downloadCSV, downloadXLSX } from "@/lib/export-utils";

interface ClassSummary {
  class_id: string;
  class_name: string;
  board: string;
  level: string;
  total_students: number;
  total_records: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
}

interface LowAttendanceStudent {
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  total_records: number;
  present_count: number;
  attendance_rate: number;
}

interface TeacherStat {
  teacher_id: string;
  teacher_name: string;
  total_sessions: number;
  total_records: number;
  present_count: number;
}

interface MonthlyTrend {
  month_start: string;
  month_label: string;
  total_records: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
}

interface ClassRow {
  id: string;
  name: string;
  board: string;
}

const supabase = createClient();

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };
}

export default function AttendanceReportsPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();

  const defaults = useMemo(getDefaultDateRange, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [threshold, setThreshold] = useState(75);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classSummary, setClassSummary] = useState<ClassSummary[]>([]);
  const [lowStudents, setLowStudents] = useState<LowAttendanceStudent[]>([]);
  const [teacherStats, setTeacherStats] = useState<TeacherStat[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (role !== "admin" && role !== "super_admin") {
      router.push(role === "teacher" ? "/admin/attendance" : "/dashboard");
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    supabase
      .from("classes")
      .select("id, name, board")
      .order("sort_order")
      .then(({ data }) => setClasses((data as ClassRow[] | null) ?? []));
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);

    const classIdParam =
      selectedClassId !== "all" ? selectedClassId : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const [summaryRes, lowRes, teacherRes, trendRes] = await Promise.all([
      client.rpc("get_class_attendance_summary", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      }),
      client.rpc("get_low_attendance_students", {
        p_threshold: threshold,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      }),
      client.rpc("get_teacher_attendance_stats", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      }),
      client.rpc("get_monthly_attendance_trend", {
        p_class_id: classIdParam ?? null,
        p_months: 12,
      }),
    ]);

    let summaryData = (summaryRes.data as ClassSummary[] | null) ?? [];
    let lowData = (lowRes.data as LowAttendanceStudent[] | null) ?? [];

    if (selectedClassId !== "all") {
      summaryData = summaryData.filter(
        (row) => row.class_id === selectedClassId,
      );
      lowData = lowData.filter((row) => row.class_id === selectedClassId);
    }

    setClassSummary(summaryData);
    setLowStudents(lowData);
    setTeacherStats((teacherRes.data as TeacherStat[] | null) ?? []);
    setMonthlyTrend((trendRes.data as MonthlyTrend[] | null) ?? []);
    setLoading(false);
  }, [dateFrom, dateTo, selectedClassId, threshold]);

  useEffect(() => {
    if (role === "admin" || role === "super_admin") {
      void fetchReports();
    }
  }, [fetchReports, role]);

  const totalRecords = classSummary.reduce(
    (sum, row) => sum + Number(row.total_records),
    0,
  );
  const totalPresent = classSummary.reduce(
    (sum, row) => sum + Number(row.present_count),
    0,
  );
  const avgRate =
    totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
  const totalStudents = classSummary.reduce(
    (sum, row) => sum + Number(row.total_students),
    0,
  );

  const classSummaryHeaders = [
    { key: "class_name", label: "Class" },
    { key: "board", label: "Board" },
    { key: "total_students", label: "Students" },
    { key: "total_records", label: "Records" },
    { key: "present_count", label: "Present" },
    { key: "absent_count", label: "Absent" },
    { key: "attendance_rate", label: "Rate %" },
  ];

  const lowStudentHeaders = [
    { key: "student_name", label: "Student" },
    { key: "class_name", label: "Class" },
    { key: "total_records", label: "Records" },
    { key: "present_count", label: "Present" },
    { key: "attendance_rate", label: "Rate %" },
  ];

  const teacherHeaders = [
    { key: "teacher_name", label: "Teacher" },
    { key: "total_sessions", label: "Sessions" },
    { key: "total_records", label: "Records" },
    { key: "present_count", label: "Present" },
  ];

  const trendHeaders = [
    { key: "month_label", label: "Month" },
    { key: "total_records", label: "Records" },
    { key: "present_count", label: "Present" },
    { key: "absent_count", label: "Absent" },
    { key: "attendance_rate", label: "Rate %" },
  ];

  function exportSection(
    rows: Record<string, unknown>[],
    headers: { key: string; label: string }[],
    name: string,
    format: "csv" | "xlsx",
  ) {
    const slug = `${name}_${dateFrom}_to_${dateTo}`;
    if (format === "csv") {
      downloadCSV(rows, headers, slug);
    } else {
      void downloadXLSX(rows, headers, slug);
    }
  }

  if (authLoading || (role !== "admin" && role !== "super_admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Analytics"
        title="Attendance Reports"
        description="Class-wise summaries, low attendance alerts, teacher session stats, and monthly trends across your institution."
      />

      <div className={cn(stitchPanelClass, "mt-8")}>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={stitchInputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={stitchInputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Class
            </label>
            <Select
              value={selectedClassId}
              onValueChange={(v) => setSelectedClassId(v ?? "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.board})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Low Threshold %
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 75)}
              className={stitchInputClass}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex min-h-40 items-center justify-center">
          <LoadingAnimation size="md" />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
            <div className={stitchPanelClass}>
              <p className="font-heading text-5xl text-primary">{avgRate}%</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Average Attendance
              </p>
            </div>
            <div className={stitchPanelClass}>
              <p className="font-heading text-5xl text-foreground">
                {totalRecords}
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Total Records
              </p>
            </div>
            <div className={stitchPanelClass}>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <p className="font-heading text-5xl text-destructive">
                  {lowStudents.length}
                </p>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Below {threshold}%
              </p>
            </div>
            <div className={stitchPanelClass}>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-foreground" />
                <p className="font-heading text-5xl text-foreground">
                  {totalStudents}
                </p>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Active Students
              </p>
            </div>
          </div>

          <div className={cn(stitchPanelClass, "mt-8")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="text-3xl text-foreground">
                  Class-wise Summary
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(stitchSecondaryButtonClass, "gap-2")}
                  onClick={() =>
                    exportSection(
                      classSummary as unknown as Record<string, unknown>[],
                      classSummaryHeaders,
                      "class_summary",
                      "csv",
                    )
                  }
                  disabled={classSummary.length === 0}
                >
                  <Download className="h-4 w-4" /> CSV
                </button>
                <button
                  type="button"
                  className={cn(stitchSecondaryButtonClass, "gap-2")}
                  onClick={() =>
                    exportSection(
                      classSummary as unknown as Record<string, unknown>[],
                      classSummaryHeaders,
                      "class_summary",
                      "xlsx",
                    )
                  }
                  disabled={classSummary.length === 0}
                >
                  <Download className="h-4 w-4" /> Excel
                </button>
              </div>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Class</th>
                    <th className="pb-2 pr-4 font-medium">Board</th>
                    <th className="pb-2 pr-4 font-medium text-right">
                      Students
                    </th>
                    <th className="pb-2 pr-4 font-medium text-right">
                      Records
                    </th>
                    <th className="pb-2 pr-4 font-medium text-right">
                      Present
                    </th>
                    <th className="pb-2 pr-4 font-medium text-right">
                      Absent
                    </th>
                    <th className="pb-2 font-medium text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="rounded-2xl border border-dashed border-black/8 px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        No attendance data in selected range.
                      </td>
                    </tr>
                  ) : (
                    classSummary.map((row) => (
                      <tr
                        key={row.class_id}
                        className="rounded-[20px] bg-white/85 shadow-[0_12px_24px_-20px_rgba(26,28,29,0.2)]"
                      >
                        <td className="rounded-l-[20px] px-4 py-3 text-sm font-medium text-foreground">
                          {row.class_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {row.board}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {row.total_students}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {row.total_records}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {row.present_count}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-destructive">
                          {row.absent_count}
                        </td>
                        <td className="rounded-r-[20px] px-4 py-3 text-right">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                              Number(row.attendance_rate) >= threshold
                                ? "bg-primary/10 text-primary"
                                : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {row.attendance_rate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {lowStudents.length > 0 && (
            <div className={cn(stitchPanelClass, "mt-8")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <h3 className="text-3xl text-foreground">
                    Low Attendance Students
                  </h3>
                  <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                    Below {threshold}%
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(stitchSecondaryButtonClass, "gap-2")}
                    onClick={() =>
                      exportSection(
                        lowStudents as unknown as Record<string, unknown>[],
                        lowStudentHeaders,
                        "low_attendance_students",
                        "csv",
                      )
                    }
                  >
                    <Download className="h-4 w-4" /> CSV
                  </button>
                  <button
                    type="button"
                    className={cn(stitchSecondaryButtonClass, "gap-2")}
                    onClick={() =>
                      exportSection(
                        lowStudents as unknown as Record<string, unknown>[],
                        lowStudentHeaders,
                        "low_attendance_students",
                        "xlsx",
                      )
                    }
                  >
                    <Download className="h-4 w-4" /> Excel
                  </button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Student</th>
                      <th className="pb-2 pr-4 font-medium">Class</th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        Records
                      </th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        Present
                      </th>
                      <th className="pb-2 font-medium text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStudents.map((row) => (
                      <tr
                        key={row.student_id}
                        className="rounded-[20px] bg-white/85 shadow-[0_12px_24px_-20px_rgba(26,28,29,0.2)]"
                      >
                        <td className="rounded-l-[20px] px-4 py-3 text-sm font-medium text-foreground">
                          {row.student_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {row.class_name}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {row.total_records}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-primary">
                          {row.present_count}
                        </td>
                        <td className="rounded-r-[20px] px-4 py-3 text-right">
                          <span className="inline-flex rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                            {row.attendance_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className={stitchPanelClass}>
              <div className="flex items-center justify-between">
                <h3 className="text-3xl text-foreground">Teacher Sessions</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(stitchSecondaryButtonClass, "gap-2")}
                    onClick={() =>
                      exportSection(
                        teacherStats as unknown as Record<string, unknown>[],
                        teacherHeaders,
                        "teacher_stats",
                        "csv",
                      )
                    }
                    disabled={teacherStats.length === 0}
                  >
                    <Download className="h-4 w-4" /> CSV
                  </button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Teacher</th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        Sessions
                      </th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        Records
                      </th>
                      <th className="pb-2 font-medium text-right">Present</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherStats.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="rounded-2xl border border-dashed border-black/8 px-4 py-8 text-center text-sm text-muted-foreground"
                        >
                          No teacher session data.
                        </td>
                      </tr>
                    ) : (
                      teacherStats.map((row) => (
                        <tr
                          key={row.teacher_id}
                          className="rounded-[20px] bg-white/85 shadow-[0_12px_24px_-20px_rgba(26,28,29,0.2)]"
                        >
                          <td className="rounded-l-[20px] px-4 py-3 text-sm font-medium text-foreground">
                            {row.teacher_name}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                            {row.total_sessions}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                            {row.total_records}
                          </td>
                          <td className="rounded-r-[20px] px-4 py-3 text-right text-sm text-primary">
                            {row.present_count}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={stitchPanelClass}>
              <div className="flex items-center justify-between">
                <h3 className="text-3xl text-foreground">Monthly Trend</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(stitchSecondaryButtonClass, "gap-2")}
                    onClick={() =>
                      exportSection(
                        monthlyTrend as unknown as Record<string, unknown>[],
                        trendHeaders,
                        "monthly_trend",
                        "csv",
                      )
                    }
                    disabled={monthlyTrend.length === 0}
                  >
                    <Download className="h-4 w-4" /> CSV
                  </button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Month</th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        Records
                      </th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        Present
                      </th>
                      <th className="pb-2 pr-4 font-medium text-right">
                        Absent
                      </th>
                      <th className="pb-2 font-medium text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrend.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="rounded-2xl border border-dashed border-black/8 px-4 py-8 text-center text-sm text-muted-foreground"
                        >
                          No monthly data available.
                        </td>
                      </tr>
                    ) : (
                      monthlyTrend.map((row) => (
                        <tr
                          key={row.month_start}
                          className="rounded-[20px] bg-white/85 shadow-[0_12px_24px_-20px_rgba(26,28,29,0.2)]"
                        >
                          <td className="rounded-l-[20px] px-4 py-3 text-sm font-medium text-foreground">
                            {row.month_label}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                            {row.total_records}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-primary">
                            {row.present_count}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-destructive">
                            {row.absent_count}
                          </td>
                          <td className="rounded-r-[20px] px-4 py-3 text-right">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                                Number(row.attendance_rate) >= threshold
                                  ? "bg-primary/10 text-primary"
                                  : Number(row.attendance_rate) > 0
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {Number(row.total_records) > 0
                                ? `${row.attendance_rate}%`
                                : "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {monthlyTrend.filter((m) => Number(m.total_records) > 0).length >
                0 && (
                <div className="mt-6">
                  <div className="flex items-end gap-1" style={{ height: 120 }}>
                    {monthlyTrend
                      .slice()
                      .reverse()
                      .map((row) => {
                        const rate = Number(row.attendance_rate);
                        const h =
                          Number(row.total_records) > 0
                            ? Math.max(rate, 4)
                            : 0;
                        return (
                          <div
                            key={row.month_start}
                            className="group relative flex-1"
                            title={`${row.month_label}: ${rate}%`}
                          >
                            <div
                              className={cn(
                                "mx-auto w-full max-w-8 rounded-t-md transition-colors",
                                rate >= threshold
                                  ? "bg-primary/30 group-hover:bg-primary/50"
                                  : rate > 0
                                    ? "bg-destructive/30 group-hover:bg-destructive/50"
                                    : "bg-muted",
                              )}
                              style={{ height: `${h}%` }}
                            />
                            <p className="mt-1 text-center text-[9px] text-muted-foreground">
                              {row.month_label.split(" ")[0]}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
