"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "next/navigation";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchInputClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { StudentFormDialog } from "@/components/admin/student-form-dialog";

interface StudentRow {
  id: string;
  profile_id: string;
  class_id: string;
  enrollment_date: string;
  created_at?: string;
  is_active: boolean;
  student_type: "tuition" | "online";
  profile: { full_name: string; phone: string } | null;
  class: { name: string; board: string } | null;
  enrollments?: Array<{ status: string; course: { title: string } | null }> | null;
  authUser?: { email: string; full_name: string; phone: string } | null;
}

function AdminStudentsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { role, user } = useAuth();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setEditingStudent(null);
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const buildAuthFallbackMap = async () => {
      const response = await fetch("/api/admin/auth-users", { cache: "no-store" });

      if (!response.ok) {
        return new Map<string, { email: string; full_name: string; phone: string }>();
      }

      const result = (await response.json()) as {
        users?: Array<{ id: string; email: string; full_name: string; phone: string }>;
      };

      return new Map(
        (result.users ?? []).map((entry) => [
          entry.id,
          {
            email: entry.email,
            full_name: entry.full_name,
            phone: entry.phone,
          },
        ]),
      );
    };

    const mergeRows = async (rows: StudentRow[] | null) => {
      const authFallbackById = await buildAuthFallbackMap();

      return ((rows ?? []).map((student) => ({
        ...student,
        authUser: authFallbackById.get(student.profile_id) ?? null,
      })));
    };

    if (role === "teacher" && user?.id) {
      const { data: accessRows } = await supabase
        .from("teacher_class_access")
        .select("class_id")
        .eq("teacher_profile_id", user.id);

      const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map(
        (row) => row.class_id,
      );

      if (classIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("students")
        .select(
          "id, profile_id, class_id, enrollment_date, created_at, is_active, student_type, profile:profiles(full_name, phone), class:classes(name, board), enrollments(status, course:courses(title))"
        )
        .in("class_id", classIds)
        .order("created_at", { ascending: false })
        .order("enrollment_date", { ascending: false });

      setStudents(await mergeRows((data as StudentRow[] | null) ?? []));
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("students")
      .select(
        "id, profile_id, class_id, enrollment_date, created_at, is_active, student_type, profile:profiles(full_name, phone), class:classes(name, board), enrollments(status, course:courses(title))"
      )
      .order("created_at", { ascending: false })
      .order("enrollment_date", { ascending: false });
    setStudents(await mergeRows((data as StudentRow[] | null) ?? []));
    setLoading(false);
  }, [role, user]);

  useEffect(() => {
    if (role === "admin" || role === "teacher") {
      void fetchStudents();
      return;
    }

    if (role === "student") {
      router.push("/dashboard");
      return;
    }
  }, [fetchStudents, role, router]);

  useEffect(() => {
    if (role !== "admin") return;
    if (searchParams?.get("create") === "1") {
      setEditingStudent(null);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, router, pathname]);

  const filtered = students.filter((student) => {
    const courseTitles = (student.enrollments ?? [])
      .map((entry) => entry.course?.title ?? "")
      .join(" ");
    const haystack = `${student.profile?.full_name ?? ""} ${student.class?.name ?? ""} ${courseTitles}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const activeCount = students.filter((student) => student.is_active).length;
  const tuitionCount = students.filter((student) => student.student_type === "tuition").length;
  const onlineCount = students.filter((student) => student.student_type === "online").length;
  const isTeacherView = role === "teacher";
  const summaryCardClass = cn(
    stitchPanelSoftClass,
    "group relative overflow-hidden border-white/70 bg-white/78 backdrop-blur-xl shadow-[0_18px_40px_-28px_rgba(26,28,29,0.22)] transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/92 hover:shadow-[0_24px_52px_-28px_rgba(26,28,29,0.26)]"
  );

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <StitchSectionHeader
          eyebrow={isTeacherView ? "Teacher Workspace" : "Administration Hub"}
          title={isTeacherView ? "Assigned Students" : "Student Management"}
          description={
            isTeacherView
              ? "Review students in your assigned classes, including their access type, board, and current status."
              : "Oversee your cohort's academic progress, administrative standing, and board affiliations through the central atelier interface."
          }
        />
        <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {isTeacherView ? null : (
            <button
              type="button"
              className={stitchButtonClass}
              onClick={() => {
                setEditingStudent(null);
                setDialogOpen(true);
              }}
            >
              Enroll Student
            </button>
          )}
          <div className="flex flex-1 gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cn(stitchInputClass, "pl-11")}
                placeholder="Filter by name or ID..."
              />
            </div>
            <button
              type="button"
              className={stitchSecondaryButtonClass}
              onClick={() => setSearch("")}
              disabled={!search.trim()}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Total Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{students.length}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">+12%</p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Active Enrollment</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{activeCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">Stable</p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Tuition Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{tuitionCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">Offline class access</p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Online Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{onlineCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">Purchase-based access</p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Users className="h-10 w-10 animate-pulse text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={Users}
            title="No Students Found"
            description="Enroll a signed-up student account to begin populating the institutional registry."
          />
        </div>
      ) : (
        <>
          <div className={cn(stitchPanelClass, "mt-8 overflow-x-auto")}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl text-foreground">
                {isTeacherView ? "Assigned Student Directory" : "Institutional Registry"}
              </h2>
              {isTeacherView ? null : (
                <button
                  type="button"
                  className={stitchButtonClass}
                  onClick={() => {
                    setEditingStudent(null);
                    setDialogOpen(true);
                  }}
                >
                  Enroll Student
                </button>
              )}
            </div>
            <table className="w-full min-w-[920px] text-left">
              <thead className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <tr>
                  <th className="pb-4 font-medium">Name & Profile</th>
                  <th className="pb-4 font-medium">Student ID</th>
                  <th className="pb-4 font-medium">Class Level</th>
                  <th className="pb-4 font-medium">Academic Board</th>
                  <th className="pb-4 font-medium">Course Access</th>
                  <th className="pb-4 font-medium">Access Type</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((student, index) => (
                  <tr key={student.id}>
                    <td className="py-4">
                      <p className="text-base text-foreground">
                        {student.profile?.full_name || student.authUser?.full_name || student.authUser?.email || "Unnamed Scholar"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {student.profile?.phone || student.authUser?.phone || student.authUser?.email || "No phone"}
                      </p>
                    </td>
                    <td className="py-4 text-sm text-primary">
                      STC-{new Date(student.enrollment_date).getFullYear()}-{String(index + 1).padStart(3, "0")}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {student.class?.name ?? "Independent Study"}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {student.class?.board ?? "Global Curriculum Board"}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {student.student_type === "online"
                        ? (student.enrollments ?? [])
                            .filter((entry) => entry.status === "active")
                            .map((entry) => entry.course?.title)
                            .filter((value): value is string => Boolean(value))
                            .join(", ") || "No purchased course"
                        : "Class resources"}
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          student.student_type === "tuition"
                            ? "bg-primary/10 text-primary"
                            : "bg-[#163241] text-[#9db7c5]"
                        }`}
                      >
                        {student.student_type === "tuition" ? "Tuition" : "Online"}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          student.is_active
                            ? "bg-primary/10 text-primary"
                            : "bg-[#3f231b] text-[#ff9b82]"
                        }`}
                      >
                        {student.is_active ? "Active" : "Pending Review"}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {isTeacherView ? (
                        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Read only
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={stitchSecondaryButtonClass}
                          onClick={() => {
                            setEditingStudent(student);
                            setDialogOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className={stitchPanelClass}>
              <h3 className="text-4xl text-foreground">
                {isTeacherView ? "Class Distribution Overview" : "Board Compliance Overview"}
              </h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                {isTeacherView
                  ? "Use this directory to confirm which students belong to each class before publishing attendance, syllabus, and materials."
                  : "Your current enrollment aligns with 94% institutional policy. Review pending status updates to maintain accreditation."}
              </p>
              {isTeacherView ? null : (
                <button
                  type="button"
                  className={cn(stitchButtonClass, "mt-8")}
                  onClick={() => router.push("/admin/classes")}
                >
                  View Compliance Report
                </button>
              )}
            </div>
            <div className={stitchPanelClass}>
              <h3 className="text-4xl text-foreground">
                {isTeacherView ? "Teaching Notes" : "Mastery Progression"}
              </h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                {isTeacherView
                  ? "Any attendance, syllabus, or material updates you publish for your assigned classes remain visible to admin automatically."
                  : "Student level distributions are trending toward advanced cohorts. Consider expanding atelier capacity for the upcoming semester."}
              </p>
              {isTeacherView ? null : (
                <button
                  type="button"
                  className={cn(stitchSecondaryButtonClass, "mt-8")}
                  onClick={() => router.push("/admin/attendance")}
                >
                  Analyze Academic Trends
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {isTeacherView ? null : (
        <StudentFormDialog
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          onSuccess={fetchStudents}
          editStudent={editingStudent}
        />
      )}
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Users className="h-10 w-10 animate-pulse text-primary" />
        </div>
      }
    >
      <AdminStudentsPageInner />
    </Suspense>
  );
}
