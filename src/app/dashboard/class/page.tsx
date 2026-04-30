"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";

interface StudentClassRecord {
  id: string;
  student_type: "tuition" | "online";
  class?: { id: string; name: string; board: string; level: string } | null;
}

interface CourseRow {
  id: string;
  title: string;
  subject: string;
}

const supabase = createClient();

export default function StudentClassPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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

    setLoading(true);
    const { data: student } = await supabase
      .from("students")
      .select("id, student_type, class:classes(id, name, board, level)")
      .eq("profile_id", user.id)
      .single();

    const typedStudent = (student as StudentClassRecord | null) ?? null;
    setClassRecord(typedStudent);

    if (typedStudent?.student_type === "online") {
      const { data: enrollmentCourses } = await supabase
        .from("enrollments")
        .select("course:courses(id, title, subject)")
        .eq("student_id", typedStudent.id)
        .eq("status", "active");

      const rows = ((enrollmentCourses as { course: CourseRow | null }[] | null) ?? [])
        .map((entry) => entry.course)
        .filter((entry): entry is CourseRow => Boolean(entry));
      setCourses(rows);
    } else if (typedStudent?.class?.id) {
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, title, subject")
        .eq("class_id", typedStudent.class.id)
        .eq("is_active", true)
        .order("title");

      setCourses((courseData as CourseRow[] | null) ?? []);
    } else {
      setCourses([]);
    }

    setLoading(false);
  }, [authLoading, router, user]);

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
            : "Review your assigned board, class level, and currently active course structure."
        }
      />

      <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6 md:grid-cols-3">
        <div className={stitchPanelClass}>
          <p className="stitch-kicker">Board</p>
          <p className="mt-5 font-heading text-5xl text-foreground">
            {classRecord.class.board}
          </p>
        </div>
        <div className={stitchPanelClass}>
          <p className="stitch-kicker">Level</p>
          <p className="mt-5 font-heading text-5xl text-foreground">
            {classRecord.class.level}
          </p>
        </div>
        <div className={cn(stitchPanelClass, "col-span-2 md:col-span-1")}>
          <p className="stitch-kicker">Active Courses</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{courses.length}</p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className={stitchPanelClass}>
          <div className="flex items-center justify-between">
            <h2 className="text-3xl text-foreground">Course Structure</h2>
            <Link href="/dashboard/syllabus" className={stitchSecondaryButtonClass}>
              View Syllabus
            </Link>
          </div>

          {courses.length === 0 ? (
            <div className={cn(stitchPanelSoftClass, "mt-6")}>
              <p className="text-sm text-muted-foreground">
                No active courses are assigned to your class yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4">
              {courses.map((course) => (
                <div key={course.id} className={stitchPanelSoftClass}>
                  <p className="text-xl text-foreground">{course.title}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{course.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={stitchPanelClass}>
          <BookOpen className="h-6 w-6 text-primary" />
          <h3 className="mt-6 text-3xl text-foreground">Next Steps</h3>
          <div className="mt-5 space-y-3 text-sm text-muted-foreground">
            <p>Review the latest syllabus for your class.</p>
            <p>Open materials published for your subjects.</p>
            <p>
              {classRecord.student_type === "online"
                ? "Track newly unlocked course content from your dashboard."
                : "Track attendance regularly to stay updated."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
