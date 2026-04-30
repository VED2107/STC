"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchPanelClass,
  stitchPanelSoftClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

const REQUIRED_ATTENDANCE = 75;

interface AttendanceRow {
  id: string;
  date: string;
  status: "present" | "absent";
  late_minutes: number | null;
  remarks: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  scan_method: string;
  class?: { name: string } | null;
  course?: { title: string; subject: string } | null;
}

interface SubjectStat {
  subject: string;
  total: number;
  present: number;
  percent: number;
}

interface StudentAccessRow {
  id: string;
  student_type: "tuition" | "online";
}

const supabase = createClient();

export default function StudentAttendancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const fetchAttendance = useCallback(async () => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    const { data: student } = await supabase
      .from("students")
      .select("id, student_type")
      .eq("profile_id", user.id)
      .single();

    if (!student) {
      setLoading(false);
      return;
    }

    const typedStudent = student as StudentAccessRow;
    if (typedStudent.student_type === "online") {
      router.replace("/dashboard");
      return;
    }

    const { data } = await supabase
      .from("attendance")
      .select(
        "id, date, status, late_minutes, remarks, check_in_at, check_out_at, scan_method, class:classes(name), course:courses(title, subject)"
      )
      .eq("student_id", typedStudent.id)
      .order("date", { ascending: false })
      .limit(365);

    const rows = (data as AttendanceRow[] | null) ?? [];
    const present = rows.filter((entry) => entry.status === "present").length;

    setRecords(rows);
    setStats({ total: rows.length, present, absent: rows.length - present });
    setLoading(false);
  }, [authLoading, router, user]);

  useEffect(() => {
    void fetchAttendance();
  }, [fetchAttendance]);

  const rate =
    stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  const monthlyRate = useMemo(() => {
    const now = new Date();
    const monthlyRows = records.filter((row) => {
      const d = new Date(row.date);
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    });

    if (monthlyRows.length === 0) {
      return 0;
    }

    const presentCount = monthlyRows.filter(
      (row) => row.status === "present"
    ).length;
    return Math.round((presentCount / monthlyRows.length) * 100);
  }, [records]);

  const subjectStats = useMemo<SubjectStat[]>(() => {
    const buckets = new Map<string, { total: number; present: number }>();

    records.forEach((row) => {
      const subject = row.course?.subject ?? "General";
      const current = buckets.get(subject) ?? { total: 0, present: 0 };
      current.total += 1;
      if (row.status === "present") {
        current.present += 1;
      }
      buckets.set(subject, current);
    });

    return [...buckets.entries()]
      .map(([subject, value]) => ({
        subject,
        total: value.total,
        present: value.present,
        percent: value.total > 0 ? Math.round((value.present / value.total) * 100) : 0,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [records]);

  const isLowAttendance = rate > 0 && rate < REQUIRED_ATTENDANCE;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Session History"
        title="Attendance Archive"
        description="Review daily status, monthly percentage, and subject-wise consistency across your class schedule."
      />

      {isLowAttendance ? (
        <div className={cn(stitchPanelSoftClass, "mt-8 border-destructive/25")}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">Low attendance warning</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your attendance is {rate}%. Required minimum is {REQUIRED_ATTENDANCE}%.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6 md:grid-cols-4">
        <div className={stitchPanelClass}>
          <p className="font-heading text-5xl text-primary">{rate}%</p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Overall Attendance
          </p>
        </div>
        <div className={stitchPanelClass}>
          <p className="font-heading text-5xl text-foreground">{monthlyRate}%</p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Current Month
          </p>
        </div>
        <div className={stitchPanelClass}>
          <p className="font-heading text-5xl text-foreground">{stats.present}</p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Days Present
          </p>
        </div>
        <div className={stitchPanelClass}>
          <p className="font-heading text-5xl text-foreground">{stats.absent}</p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Days Absent
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {records.length === 0 ? (
          <div className="xl:col-span-2">
            <StitchEmptyState
              icon={CalendarCheck}
              title="No Attendance Records"
              description="Attendance history will appear here once your sessions begin."
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className={cn(
                    stitchPanelSoftClass,
                    "flex items-center justify-between gap-4"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/3">
                      {record.status === "present" ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-base text-foreground">
                        {record.course?.title ?? record.class?.name ?? "Studio Session"}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {new Date(record.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {record.status === "present" && (record.late_minutes ?? 0) > 0
                          ? ` • Late by ${record.late_minutes} min`
                          : ""}
                      </p>
                      {record.remarks ? (
                        <p className="mt-2 text-sm text-muted-foreground">{record.remarks}</p>
                      ) : null}
                      {record.check_in_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          In: {new Date(record.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
                          {record.check_out_at && (
                            <> → Out: {new Date(record.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] ${
                      record.status === "present"
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {record.status}
                    {record.scan_method === "qr" && (
                      <span className="ml-1 text-[9px] text-blue-500">QR</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className={stitchPanelClass}>
              <h3 className="text-3xl text-foreground">Subject-wise Attendance</h3>
              <div className="mt-5 space-y-3">
                {subjectStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subject data yet.</p>
                ) : (
                  subjectStats.map((subject) => (
                    <div
                      key={subject.subject}
                      className={cn(
                        stitchPanelSoftClass,
                        "flex items-center justify-between"
                      )}
                    >
                      <div>
                        <p className="text-sm text-foreground">{subject.subject}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {subject.present}/{subject.total} present
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs",
                          subject.percent < REQUIRED_ATTENDANCE
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {subject.percent}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
