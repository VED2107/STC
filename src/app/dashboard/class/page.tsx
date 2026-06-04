"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, GitBranch, Layers, QrCode, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { getCached, setCache } from "@/lib/dashboard-cache";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

interface StudentClassRecord {
  id: string;
  class_id?: string | null;
  branch_id?: string | null;
  student_type: "tuition" | "online";
  class?: { id: string; name: string; board: string; level: string } | null;
  branch?: { id: string; name: string } | null;
}

interface CourseRow {
  id: string;
  title: string;
  subject: string;
}

interface EnrollmentCourseRow {
  id: string;
  title: string;
  subject: string;
  class_id?: string | null;
}

interface SyllabusRow {
  id: string;
  class_id: string;
  subject: string;
}

const supabase = createClient();

export default function StudentClassPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classRecord, setClassRecord] = useState<StudentClassRecord | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);

  const fetchData = useCallback(async () => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }

    /* Admins and teachers don't have student records — skip the query */
    if (role === "admin" || role === "super_admin" || role === "teacher") {
      setLoading(false);
      return;
    }

    const cacheKey = `student:class:${user.id}`;
    const cached = getCached<{ classRecord: StudentClassRecord; courses: CourseRow[] }>(cacheKey);
    if (cached) {
      setClassRecord(cached.classRecord);
      setCourses(cached.courses);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const response = await fetch("/api/student/class-context", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      setClassRecord(null);
      setCourses([]);
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as {
      student: StudentClassRecord | null;
      class: StudentClassRecord["class"];
      branch: StudentClassRecord["branch"];
      courses: EnrollmentCourseRow[];
    };

    const resolvedStudent = payload.student
      ? {
          ...payload.student,
          class: payload.class ?? null,
          branch: payload.branch ?? null,
        }
      : null;

    if (resolvedStudent?.student_type === "online") {
      setCourses(
        (payload.courses ?? []).map((entry) => ({
          id: entry.id,
          title: entry.title,
          subject: entry.subject,
        })),
      );
    } else if (resolvedStudent?.class_id) {
      const { data: syllabusData } = await supabase
        .from("syllabus")
        .select("id, class_id, subject")
        .eq("class_id", resolvedStudent.class_id)
        .order("subject");

      const rows = (((syllabusData as SyllabusRow[] | null) ?? []).map((entry) => ({
        id: entry.id,
        title: entry.subject,
        subject: entry.subject,
      })));
      setCourses(rows);
    } else {
      setCourses([]);
    }

    setClassRecord(resolvedStudent);
    setLoading(false);
    if (resolvedStudent) {
      setCache(cacheKey, { classRecord: resolvedStudent, courses });
    }
  }, [authLoading, role, router, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  /* ── Admin / Teacher guard — same pattern as main dashboard ── */
  if (role === "admin" || role === "super_admin" || role === "teacher") {
    return (
      <div className="px-6 py-10 md:px-10">
        <div className={stitchPanelClass}>
          <h1 className="text-5xl text-foreground">
            {role === "teacher" ? "Teacher Access Active" : "Admin Access Active"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
            This page shows class details for student accounts. Use the command
            center to manage classes, students, and academic structures.
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

  if (!classRecord?.class) {
    return (
      <div className="px-6 py-8 md:px-10">
        <StitchEmptyState
          icon={GraduationCap}
          title="No Class Assigned"
          description="Your student profile is not linked to a class yet. Contact the academy administrator for assignment."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow={classRecord.student_type === "online" ? "Online Learner" : "Student Record"}
        title={classRecord.class.name}
        description={
          classRecord.student_type === "online"
            ? "Review your purchased courses and linked class context."
            : "Review your assigned board, class level, and currently active subject structure."
        }
      />

      <div className={cn("mt-10 grid grid-cols-2 gap-4 md:gap-6", classRecord.branch ? "md:grid-cols-4" : "md:grid-cols-3")}>
        {(() => {
          const summaryCardClass = cn(
            stitchPanelSoftClass,
            "group relative overflow-hidden border-white/70 bg-white/78 backdrop-blur-xl shadow-[0_18px_40px_-28px_rgba(26,28,29,0.22)] transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/92 hover:shadow-[0_24px_52px_-28px_rgba(26,28,29,0.26)]"
          );
          const gradientOverlay = (gradient: string) => (
            <>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
            </>
          );
          return (
            <>
              <div className={summaryCardClass}>
                {gradientOverlay("from-[#eef2ff]/40")}
                <div className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3651a5] transition-transform duration-300 group-hover:scale-110">
                    <Shield className="h-5 w-5" />
                  </span>
                  <p className="stitch-kicker mt-3">Board</p>
                  <p className="mt-3 font-heading text-5xl text-foreground">
                    {classRecord.class.board}
                  </p>
                </div>
              </div>
              <div className={summaryCardClass}>
                {gradientOverlay("from-[#fff2dc]/40")}
                <div className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff2dc] text-[#9a6500] transition-transform duration-300 group-hover:scale-110">
                    <Layers className="h-5 w-5" />
                  </span>
                  <p className="stitch-kicker mt-3">Level</p>
                  <p className="mt-3 font-heading text-5xl text-foreground">
                    {classRecord.class.level}
                  </p>
                </div>
              </div>
              {classRecord.branch ? (
                <div className={summaryCardClass}>
                  {gradientOverlay("from-[#f1edff]/40")}
                  <div className="relative">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1edff] text-[#6a4bc4] transition-transform duration-300 group-hover:scale-110">
                      <GitBranch className="h-5 w-5" />
                    </span>
                    <p className="stitch-kicker mt-3">Branch</p>
                    <p className="mt-3 font-heading text-3xl text-foreground">
                      {classRecord.branch.name}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className={cn(summaryCardClass, classRecord.branch ? "" : "col-span-2 md:col-span-1")}>
                {gradientOverlay("from-[#d0e9d4]/30")}
                <div className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d0e9d4]/55 text-[#374c3d] transition-transform duration-300 group-hover:scale-110">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <p className="stitch-kicker mt-3">{classRecord.student_type === "online" ? "Purchased Courses" : "Active Subjects"}</p>
                  <p className="mt-3 font-heading text-5xl text-foreground">{courses.length}</p>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div className="mt-10 grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className={stitchPanelClass}>
          <div className="flex items-center justify-between">
            <h2 className="text-3xl text-foreground">{classRecord.student_type === "online" ? "Course Structure" : "Subject Structure"}</h2>
            <Link href="/dashboard/syllabus" className={stitchSecondaryButtonClass}>
              View Syllabus
            </Link>
          </div>

          {courses.length === 0 ? (
            <div className={cn(stitchPanelSoftClass, "mt-6")}>
              <p className="text-sm text-muted-foreground">
                {classRecord.student_type === "online"
                  ? "No purchased courses are active on your account yet."
                  : "No active subjects are assigned to your class yet."}
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4">
              {courses.map((course) => (
                <div key={course.id} className={cn(stitchPanelSoftClass, "stitch-hover-lift flex items-start gap-3")}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3651a5]">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xl text-foreground">{course.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{course.subject}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={stitchPanelClass}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3651a5]">
            <BookOpen className="h-5 w-5" />
          </span>
          <h3 className="mt-6 text-3xl text-foreground">Next Steps</h3>
          <div className="mt-5 space-y-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fff2dc] text-[#9a6500]">
                <Layers className="h-3.5 w-3.5" />
              </span>
              <p>Review the latest syllabus for your class.</p>
            </div>
            <div className="h-px bg-gradient-to-r from-secondary/20 via-secondary/5 to-transparent" />
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f1edff] text-[#6a4bc4]">
                <BookOpen className="h-3.5 w-3.5" />
              </span>
              <p>Open materials published for your subjects.</p>
            </div>
            <div className="h-px bg-gradient-to-r from-secondary/20 via-secondary/5 to-transparent" />
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d0e9d4]/55 text-[#374c3d]">
                <GraduationCap className="h-3.5 w-3.5" />
              </span>
              <p>
                {classRecord.student_type === "online"
                  ? "Track newly unlocked course content from your dashboard."
                  : "Track attendance regularly to stay updated."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
