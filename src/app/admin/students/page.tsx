"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Search, Users } from "lucide-react";
import { downloadCSV, downloadXLSX } from "@/lib/export-utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
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
import { CsvUploadDialog } from "@/components/admin/csv-upload-dialog";
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";
import {
  getFeesStatusLabel,
  hasFullPaymentMarked,
  isFullyPaid,
  isPartiallyPaid,
} from "@/lib/student-fees";
import {
  buildStudentExportRows,
  studentExportHeaders,
  type StudentAttendanceSummary,
} from "@/lib/student-export";
import { generateStudentFormPDF } from "@/lib/student-form-pdf";

interface StudentRow {
  rowKind: "enrolled" | "pending";
  id: string;
  profile_id: string;
  class_id: string | null;
  enrollment_date: string | null;
  created_at?: string;
  is_active: boolean;
  student_type: "tuition" | "online";
  fees_amount: number;
  fees_full_payment_paid: boolean;
  fees_installment1_paid: boolean;
  fees_installment2_paid: boolean;
  profile: { full_name: string; phone: string; email?: string | null; avatar_url?: string | null } | null;
  class: { name: string; board: string } | null;
  enrollments?: Array<{ status: string; course: { title: string } | null }> | null;
}

type PendingProfileRow = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string;
};

const supabase = createClient();

function AdminStudentsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { role, user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const studentsCacheKey = role === "teacher" && user?.id
    ? `admin:students:teacher:${user.id}`
    : "admin:students:admin";
  const [students, setStudents] = useState<StudentRow[]>(
    () => getAdminPageCache<StudentRow[]>(studentsCacheKey) ?? [],
  );
  const [loading, setLoading] = useState(
    () => getAdminPageCache<StudentRow[]>(studentsCacheKey) === null,
  );
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [initialProfileId, setInitialProfileId] = useState<string | null>(null);

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setEditingStudent(null);
      setInitialProfileId(null);
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  const fetchStudents = useCallback(async () => {
    const cachedStudents = getAdminPageStorageCache<StudentRow[]>(studentsCacheKey);
    if (cachedStudents) {
      setStudents(cachedStudents);
      setLoading(false);
    } else {
      setLoading(true);
    }

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
          "id, profile_id, class_id, enrollment_date, created_at, is_active, student_type, fees_amount, fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid, profile:profiles(full_name, phone, email, avatar_url), class:classes(name, board), enrollments(status, course:courses(title))"
        )
        .in("class_id", classIds)
        .order("created_at", { ascending: false })
        .order("enrollment_date", { ascending: false });

      const nextEnrolledStudents = ((data as Omit<StudentRow, "rowKind">[] | null) ?? []).map(
        (student) => ({
          ...student,
          rowKind: "enrolled" as const,
        }),
      );

      setStudents(nextEnrolledStudents);
      setAdminPageCache(studentsCacheKey, nextEnrolledStudents);
      setLoading(false);
      return;
    }

    const [{ data: studentData }, { data: profileData }] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, profile_id, class_id, enrollment_date, created_at, is_active, student_type, fees_amount, fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid, profile:profiles(full_name, phone, email, avatar_url), class:classes(name, board), enrollments(status, course:courses(title))"
        )
        .order("created_at", { ascending: false })
        .order("enrollment_date", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, phone, email, avatar_url, created_at")
        .eq("role", "student")
        .order("created_at", { ascending: false }),
    ]);

    const enrolledStudents = ((studentData as Omit<StudentRow, "rowKind">[] | null) ?? []).map(
      (student) => ({
        ...student,
        rowKind: "enrolled" as const,
      }),
    );

    const enrolledProfileIds = new Set(enrolledStudents.map((student) => student.profile_id));
    const pendingStudents = ((profileData as PendingProfileRow[] | null) ?? [])
      .filter((profile) => !enrolledProfileIds.has(profile.id))
      .map((profile) => ({
        rowKind: "pending" as const,
        id: profile.id,
        profile_id: profile.id,
        class_id: null,
        enrollment_date: null,
        created_at: profile.created_at,
        is_active: false,
        student_type: "online" as const,
        fees_amount: 0,
        fees_full_payment_paid: false,
        fees_installment1_paid: false,
        fees_installment2_paid: false,
        profile: {
          full_name: profile.full_name,
          phone: profile.phone,
          email: profile.email,
          avatar_url: profile.avatar_url,
        },
        class: null,
        enrollments: [],
      }));

    const nextStudents = [...pendingStudents, ...enrolledStudents];
    setStudents(nextStudents);
    setAdminPageCache(studentsCacheKey, nextStudents);
    setLoading(false);
  }, [role, studentsCacheKey, user]);

  useEffect(() => {
    if (authLoading) return;

    if (role === "admin" || role === "super_admin" || role === "teacher") {
      void fetchStudents();
      return;
    }

    if (role === "student") {
      router.push("/dashboard");
    }
  }, [fetchStudents, role, router, authLoading]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    if (searchParams?.get("create") === "1") {
      setEditingStudent(null);
      setInitialProfileId(null);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, router, pathname]);

  const filtered = students.filter((student) => {
    const courseTitles = (student.enrollments ?? [])
      .map((entry) => entry.course?.title ?? "")
      .join(" ");
    const haystack = [
      student.profile?.full_name ?? "",
      student.profile?.phone ?? "",
      student.profile?.email ?? "",
      student.class?.name ?? "",
      courseTitles,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.toLowerCase());
  });

  const enrolledStudents = students.filter((student) => student.rowKind === "enrolled");
  const activeCount = enrolledStudents.filter((student) => student.is_active).length;
  const pendingCount = students.filter((student) => student.rowKind === "pending").length;
  const isTeacherView = role === "teacher";
  const feesPaidCount = enrolledStudents.filter((student) => isFullyPaid(student)).length;
  const feesPartialCount = enrolledStudents.filter((student) => isPartiallyPaid(student)).length;
  const feesNotPaidCount = enrolledStudents.filter(
    (student) => !isFullyPaid(student) && !isPartiallyPaid(student),
  ).length;

  async function loadAttendanceSummary(studentIds: string[]) {
    if (studentIds.length === 0) {
      return {} as Record<string, StudentAttendanceSummary>;
    }

    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, status, date")
      .in("student_id", studentIds)
      .order("date", { ascending: false });

    if (error) {
      throw error;
    }

    const summary: Record<string, StudentAttendanceSummary> = {};
    for (const row of ((data as Array<{ student_id: string; status: string; date: string }> | null) ?? [])) {
      if (!summary[row.student_id]) {
        summary[row.student_id] = {
          presentCount: 0,
          absentCount: 0,
          totalSessions: 0,
          lastAttendanceDate: row.date,
        };
      }

      summary[row.student_id].totalSessions += 1;
      if (row.status === "present") {
        summary[row.student_id].presentCount += 1;
      } else {
        summary[row.student_id].absentCount += 1;
      }
    }

    return summary;
  }

  async function loadClassSubjects(classIds: string[]) {
    if (classIds.length === 0) {
      return {} as Record<string, string[]>;
    }

    const { data, error } = await supabase
      .from("courses")
      .select("class_id, subject")
      .in("class_id", classIds)
      .order("subject", { ascending: true });

    if (error) {
      console.error("Failed to load class subjects for student form", error);
      return {} as Record<string, string[]>;
    }

    const subjectMap: Record<string, string[]> = {};

    for (const row of (data as Array<{ class_id: string | null; subject: string | null }> | null) ?? []) {
      const classId = row.class_id?.trim();
      const subject = row.subject?.trim();

      if (!classId || !subject) continue;

      const subjects = subjectMap[classId] ?? [];
      if (!subjects.includes(subject)) {
        subjects.push(subject);
      }
      subjectMap[classId] = subjects;
    }

    return subjectMap;
  }

  function getExportFilename() {
    const today = new Date().toISOString().split("T")[0];
    if (filtered.length === 1 && filtered[0].profile?.full_name) {
      const name = filtered[0].profile.full_name.replace(/\s+/g, "_");
      return `${name}_${today}`;
    }
    return `all_students_${today}`;
  }

  async function handleDownloadCSV() {
    const enrolledIds = filtered
      .filter((student) => student.rowKind === "enrolled")
      .map((student) => student.id);
    const attendanceByStudentId = await loadAttendanceSummary(enrolledIds);
    downloadCSV(
      buildStudentExportRows(filtered, attendanceByStudentId),
      studentExportHeaders,
      getExportFilename(),
    );
  }

  async function handleDownloadXLSX() {
    const enrolledIds = filtered
      .filter((student) => student.rowKind === "enrolled")
      .map((student) => student.id);
    const attendanceByStudentId = await loadAttendanceSummary(enrolledIds);
    await downloadXLSX(
      buildStudentExportRows(filtered, attendanceByStudentId),
      studentExportHeaders,
      getExportFilename(),
    );
  }

  async function handleDownloadForm() {
    const classIds = Array.from(
      new Set(
        filtered
          .map((student) => student.class_id)
          .filter((classId): classId is string => Boolean(classId)),
      ),
    );
    const classSubjectsByClassId = await loadClassSubjects(classIds);

    await generateStudentFormPDF(
      filtered,
      classSubjectsByClassId,
      getExportFilename() + "_form",
    );
  }

  const summaryCardClass = cn(
    stitchPanelSoftClass,
    "group relative overflow-hidden border-white/70 bg-white/78 backdrop-blur-xl shadow-[0_18px_40px_-28px_rgba(26,28,29,0.22)] transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/92 hover:shadow-[0_24px_52px_-28px_rgba(26,28,29,0.26)]",
  );
  const editStudentForDialog =
    editingStudent?.rowKind === "enrolled" && editingStudent.class_id
      ? {
          ...editingStudent,
          class_id: editingStudent.class_id,
        }
      : null;

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
        <div className="flex w-full flex-col gap-3 xl:max-w-none xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
          {isTeacherView ? null : (
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "gap-2")}
                onClick={() => setCsvDialogOpen(true)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Bulk Upload
              </button>
              <button
                type="button"
                className={stitchButtonClass}
                onClick={() => {
                  setEditingStudent(null);
                  setInitialProfileId(null);
                  setDialogOpen(true);
                }}
              >
                Enroll Student
              </button>
            </div>
          )}
          <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto xl:min-w-[380px] xl:max-w-[520px] xl:flex-1">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cn(stitchInputClass, "pl-11")}
                placeholder="Filter by name, phone, email, or subject..."
              />
            </div>
            <button
              type="button"
              className={cn(stitchSecondaryButtonClass, "gap-2")}
              onClick={() => setSearch((value) => value.trim())}
              disabled={!search.trim()}
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            <button
              type="button"
              className={stitchSecondaryButtonClass}
              onClick={() => setSearch("")}
              disabled={!search.trim()}
            >
              Clear
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(stitchSecondaryButtonClass, "gap-2")}
              onClick={() => void handleDownloadCSV()}
              disabled={filtered.length === 0}
              title="Download as CSV"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              className={cn(stitchSecondaryButtonClass, "gap-2")}
              onClick={() => void handleDownloadXLSX()}
              disabled={filtered.length === 0}
              title="Download as Excel"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button
              type="button"
              className={cn(stitchSecondaryButtonClass, "gap-2")}
              onClick={() => void handleDownloadForm()}
              disabled={filtered.length === 0}
              title="Download student form as PDF"
            >
              <FileText className="h-4 w-4" />
              Form
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Total Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{students.length}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Active: {activeCount}
            {pendingCount > 0 ? ` | Pending: ${pendingCount}` : ""}
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Fees Fully Paid</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{feesPaidCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Full payment or both installments
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Fees Partial</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{feesPartialCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Installments in progress
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <p className="stitch-kicker">Fees Not Paid</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{feesNotPaidCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            No payment received
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={Users}
            title="No Students Found"
            description="Signed-up accounts and enrolled students will appear here as soon as they are available."
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
                    setInitialProfileId(null);
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
                  <th className="pb-4 font-medium">Subject Access</th>
                  <th className="pb-4 font-medium">Access Type</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Fees</th>
                  <th className="pb-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((student, index) => (
                  <tr key={`${student.rowKind}-${student.id}`}>
                    <td className="py-4">
                      <p className="text-base text-foreground">
                        {student.profile?.full_name || "Unnamed Scholar"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {student.profile?.phone || student.profile?.email || "No contact info"}
                      </p>
                    </td>
                    <td className="py-4 text-sm text-primary">
                      {student.enrollment_date
                        ? `STC-${new Date(student.enrollment_date).getFullYear()}-${String(index + 1).padStart(3, "0")}`
                        : "Pending"}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {student.class?.name ?? "Awaiting assignment"}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {student.class?.board ?? "Pending"}
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {student.rowKind === "pending"
                        ? "No online course"
                        : student.student_type === "online"
                          ? (student.enrollments ?? [])
                              .filter((entry) => entry.status === "active")
                              .map((entry) => entry.course?.title)
                              .filter((value): value is string => Boolean(value))
                              .join(", ") || "No online course"
                          : "Free class subjects"}
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          student.rowKind === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : student.student_type === "tuition"
                              ? "bg-primary/10 text-primary"
                              : "bg-[#163241] text-[#9db7c5]"
                        }`}
                      >
                        {student.rowKind === "pending"
                          ? "Signup"
                          : student.student_type === "tuition"
                            ? "Tuition"
                            : "Online"}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          student.rowKind === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : student.is_active
                              ? "bg-primary/10 text-primary"
                              : "bg-[#3f231b] text-[#ff9b82]"
                        }`}
                      >
                        {student.rowKind === "pending"
                          ? "Pending Enrollment"
                          : student.is_active
                            ? "Active"
                            : "Pending Review"}
                      </span>
                    </td>
                    <td className="py-4">
                      {student.rowKind === "pending" ? (
                        <div className="space-y-1">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                            Pending enrollment
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Fees can be added after class assignment.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${
                              isFullyPaid(student)
                                ? "bg-green-100 text-green-700"
                                : isPartiallyPaid(student)
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {getFeesStatusLabel(student)}
                          </span>
                          {hasFullPaymentMarked(student) ? (
                            <p className="text-xs text-green-700">Settled with full payment</p>
                          ) : null}
                          {student.fees_amount > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Rs {student.fees_amount.toLocaleString("en-IN")}
                            </p>
                          ) : null}
                        </div>
                      )}
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
                            if (student.rowKind === "pending") {
                              setEditingStudent(null);
                              setInitialProfileId(student.profile_id);
                            } else {
                              setEditingStudent(student);
                              setInitialProfileId(null);
                            }
                            setDialogOpen(true);
                          }}
                        >
                          {student.rowKind === "pending" ? "Enroll" : "Edit"}
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
        <>
          <StudentFormDialog
            open={dialogOpen}
            onOpenChange={handleDialogOpenChange}
            onSuccess={fetchStudents}
            editStudent={editStudentForDialog}
            initialProfileId={initialProfileId}
          />
          <CsvUploadDialog
            open={csvDialogOpen}
            onOpenChange={setCsvDialogOpen}
            onSuccess={fetchStudents}
          />
        </>
      )}
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <AdminStudentsPageInner />
    </Suspense>
  );
}
