"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, ArrowRightLeft, CircleDollarSign, Clock, Download, FileSpreadsheet, FileText, Loader2, Search, UserCheck, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import dynamic from "next/dynamic";

const StudentFormDialog = dynamic(() => import("@/components/admin/student-form-dialog").then(mod => ({ default: mod.StudentFormDialog })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>
});

const CsvUploadDialog = dynamic(() => import("@/components/admin/csv-upload-dialog").then(mod => ({ default: mod.CsvUploadDialog })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>
});
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
import { invalidateAfterStudentMigration } from "@/lib/cache-invalidation";

interface StudentRow {
  rowKind: "enrolled" | "pending";
  id: string;
  profile_id: string;
  class_id: string | null;
  branch_id: string | null;
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
  branch: { name: string } | null;
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
  const [selectedClassFilterId, setSelectedClassFilterId] = useState("");
  const [selectedBranchFilterId, setSelectedBranchFilterId] = useState("");

  // ─── Student Migration state ─────────────────────────────────────
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrateSourceClassId, setMigrateSourceClassId] = useState("");
  const [migrateTargetClassId, setMigrateTargetClassId] = useState("");
  const [migrateResetFees, setMigrateResetFees] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrateError, setMigrateError] = useState("");
  const [migrateSuccess, setMigrateSuccess] = useState("");
  const [allClasses, setAllClasses] = useState<Array<{ id: string; name: string; board: string; level: string }>>([]);

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
      // Optimized teacher query with single database roundtrip
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
        setAdminPageCache(studentsCacheKey, []);
        return;
      }

      const { data } = await supabase
        .from("students")
        .select(
          "id, profile_id, class_id, branch_id, enrollment_date, created_at, is_active, student_type, fees_amount, fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid, profile:profiles(full_name, phone, email, avatar_url), class:classes(name, board), branch:branches(name), enrollments(status, course:courses(title))"
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

    // Optimized batch queries with more selective field retrieval
    const [{ data: studentData }, { data: profileData }] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, profile_id, class_id, branch_id, enrollment_date, created_at, is_active, student_type, fees_amount, fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid, profile:profiles(full_name, phone, email, avatar_url), class:classes(name, board), branch:branches(name), enrollments(status, course:courses(title))"
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
        branch_id: null,
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
        branch: null,
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

  // Class and branch filter lists derived from loaded student data
  const filterClasses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of students) {
      if (s.class_id && s.class?.name && !seen.has(s.class_id)) {
        seen.set(s.class_id, s.class.name);
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const filterBranches = useMemo(() => {
    if (!selectedClassFilterId) return [];
    const seen = new Map<string, string>();
    for (const s of students) {
      if (s.class_id === selectedClassFilterId && s.branch_id && s.branch?.name && !seen.has(s.branch_id)) {
        seen.set(s.branch_id, s.branch.name);
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedClassFilterId]);

  // Reset branch when class changes
  useEffect(() => {
    setSelectedBranchFilterId("");
  }, [selectedClassFilterId]);

  // Memoized filtered students for better performance
  const filtered = useMemo(() => {
    let result = students;
    if (selectedClassFilterId) {
      result = result.filter((s) => s.class_id === selectedClassFilterId);
    }
    if (selectedBranchFilterId) {
      result = result.filter((s) => s.branch_id === selectedBranchFilterId);
    }
    if (!search.trim()) return result;

    const searchTerm = search.toLowerCase();
    return result.filter((student) => {
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

      return haystack.includes(searchTerm);
    });
  }, [students, search, selectedClassFilterId, selectedBranchFilterId]);

  // Memoized student statistics for better performance
  const studentStats = useMemo(() => {
    const enrolledStudents = students.filter((student) => student.rowKind === "enrolled");
    const activeCount = enrolledStudents.filter((student) => student.is_active).length;
    const pendingCount = students.filter((student) => student.rowKind === "pending").length;

    let feesPaidCount = 0;
    let feesPartialCount = 0;
    let feesNotPaidCount = 0;

    for (const student of enrolledStudents) {
      if (isFullyPaid(student)) {
        feesPaidCount++;
      } else if (isPartiallyPaid(student)) {
        feesPartialCount++;
      } else {
        feesNotPaidCount++;
      }
    }

    return {
      enrolledStudents,
      activeCount,
      pendingCount,
      feesPaidCount,
      feesPartialCount,
      feesNotPaidCount,
    };
  }, [students]);

  const isTeacherView = role === "teacher";
  const { enrolledStudents, activeCount, pendingCount, feesPaidCount, feesPartialCount, feesNotPaidCount } = studentStats;

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

  // Memoized export filename calculation
  const exportFilename = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    if (filtered.length === 1 && filtered[0].profile?.full_name) {
      const name = filtered[0].profile.full_name.replace(/\s+/g, "_");
      return `${name}_${today}`;
    }
    return `all_students_${today}`;
  }, [filtered]);

  const handleDownloadCSV = useCallback(async () => {
    const enrolledIds = filtered
      .filter((student) => student.rowKind === "enrolled")
      .map((student) => student.id);
    const attendanceByStudentId = await loadAttendanceSummary(enrolledIds);
    downloadCSV(
      buildStudentExportRows(filtered, attendanceByStudentId),
      studentExportHeaders,
      exportFilename,
    );
  }, [filtered, exportFilename]);

  const handleDownloadXLSX = useCallback(async () => {
    const enrolledIds = filtered
      .filter((student) => student.rowKind === "enrolled")
      .map((student) => student.id);
    const attendanceByStudentId = await loadAttendanceSummary(enrolledIds);
    await downloadXLSX(
      buildStudentExportRows(filtered, attendanceByStudentId),
      studentExportHeaders,
      exportFilename,
    );
  }, [filtered, exportFilename]);

  const handleDownloadForm = useCallback(async () => {
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
      exportFilename + "_form",
    );
  }, [filtered, exportFilename]);

  // ─── Migration helpers ───────────────────────────────────────────

  async function loadAllClasses() {
    const { data } = await supabase
      .from("classes")
      .select("id, name, board, level")
      .order("sort_order");
    setAllClasses((data as Array<{ id: string; name: string; board: string; level: string }> | null) ?? []);
  }

  function openMigrateDialog() {
    setMigrateSourceClassId("");
    setMigrateTargetClassId("");
    setMigrateResetFees(true);
    setMigrateError("");
    setMigrateSuccess("");
    setMigrateDialogOpen(true);
    void loadAllClasses();
  }

  const migrateSourceStudentCount = useMemo(() => {
    if (!migrateSourceClassId) return 0;
    return students.filter(
      (s) => s.rowKind === "enrolled" && s.is_active && s.class_id === migrateSourceClassId,
    ).length;
  }, [students, migrateSourceClassId]);

  async function handleMigrateStudents() {
    if (!migrateSourceClassId || !migrateTargetClassId) {
      setMigrateError("Select both source and target classes.");
      return;
    }
    if (migrateSourceClassId === migrateTargetClassId) {
      setMigrateError("Source and target class must be different.");
      return;
    }
    if (migrateSourceStudentCount === 0) {
      setMigrateError("No active students found in the source class.");
      return;
    }

    const sourceName = allClasses.find((c) => c.id === migrateSourceClassId)?.name ?? "source";
    const targetName = allClasses.find((c) => c.id === migrateTargetClassId)?.name ?? "target";
    const confirmed = window.confirm(
      `Migrate ${migrateSourceStudentCount} active student(s) from ${sourceName} to ${targetName}?${migrateResetFees ? "\n\nFee status will be reset for the new year." : ""}`,
    );
    if (!confirmed) return;

    setMigrating(true);
    setMigrateError("");
    setMigrateSuccess("");

    try {
      const updatePayload: Record<string, unknown> = {
        class_id: migrateTargetClassId,
        branch_id: null,
        updated_at: new Date().toISOString(),
      };

      if (migrateResetFees) {
        updatePayload.fees_amount = 0;
        updatePayload.fees_full_payment_paid = false;
        updatePayload.fees_installment1_paid = false;
        updatePayload.fees_installment2_paid = false;
      }

      const { error } = await supabase
        .from("students")
        .update(updatePayload)
        .eq("class_id", migrateSourceClassId)
        .eq("is_active", true);

      if (error) throw error;

      setMigrateSuccess(`Successfully migrated ${migrateSourceStudentCount} student(s) from ${sourceName} to ${targetName}.`);
      invalidateAfterStudentMigration();
      void fetchStudents();
    } catch (err) {
      console.error("Failed to migrate students:", err);
      setMigrateError(err instanceof Error ? err.message : "Migration failed.");
    } finally {
      setMigrating(false);
    }
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
                className={cn(stitchSecondaryButtonClass, "gap-2")}
                onClick={openMigrateDialog}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Migrate Class
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
          <div className="flex items-center justify-between">
            <p className="stitch-kicker">Total Students</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/15">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-heading text-5xl text-foreground">{students.length}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            <span className="font-medium text-primary">{activeCount}</span> active
            {pendingCount > 0 ? <> &middot; <span className="font-medium text-amber-600">{pendingCount}</span> pending</> : ""}
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <p className="stitch-kicker">Fees Fully Paid</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/8 text-emerald-600 transition-colors group-hover:bg-emerald-500/15">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-heading text-5xl text-emerald-600">{feesPaidCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Full payment or both installments
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <p className="stitch-kicker">Fees Partial</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/8 text-amber-600 transition-colors group-hover:bg-amber-500/15">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-heading text-5xl text-amber-600">{feesPartialCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            Installments in progress
          </p>
        </div>
        <div className={summaryCardClass}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <p className="stitch-kicker">Fees Not Paid</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/8 text-rose-600 transition-colors group-hover:bg-rose-500/15">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 font-heading text-5xl text-rose-600">{feesNotPaidCount}</p>
          <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground/72">
            No payment received
          </p>
        </div>
      </div>

      {filterClasses.length > 0 ? (
        <div className={cn(stitchPanelClass, "mt-6")}>
          <div className={cn("grid gap-4", filterBranches.length > 0 ? "md:grid-cols-2" : "md:grid-cols-1 max-w-xs")}>
            <Select
              value={selectedClassFilterId || "__all"}
              onValueChange={(v) => setSelectedClassFilterId(v === "__all" ? "" : (v ?? ""))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All classes">
                  {selectedClassFilterId
                    ? filterClasses.find((c) => c.id === selectedClassFilterId)?.name ?? "All classes"
                    : "All classes"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All classes</SelectItem>
                {filterClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filterBranches.length > 0 ? (
              <Select
                value={selectedBranchFilterId || "__all"}
                onValueChange={(v) => setSelectedBranchFilterId(v === "__all" ? "" : (v ?? ""))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All branches">
                    {selectedBranchFilterId
                      ? filterBranches.find((b) => b.id === selectedBranchFilterId)?.name ?? "All branches"
                      : "All branches"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All branches</SelectItem>
                  {filterBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          {(selectedClassFilterId || selectedBranchFilterId) ? (
            <button
              type="button"
              className="mt-3 text-xs text-muted-foreground transition hover:text-foreground"
              onClick={() => { setSelectedClassFilterId(""); setSelectedBranchFilterId(""); }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

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
            <table className="w-full min-w-[1040px] text-left">
              <thead className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <tr className="border-b-2 border-border/60">
                  <th className="pb-4 font-medium">Name & Profile</th>
                  <th className="pb-4 font-medium">Student ID</th>
                  <th className="pb-4 font-medium">Class Level</th>
                  <th className="pb-4 font-medium">Branch</th>
                  <th className="pb-4 font-medium">Academic Board</th>
                  <th className="pb-4 font-medium">Subject Access</th>
                  <th className="pb-4 font-medium">Access Type</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Fees</th>
                  <th className="pb-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((student, index) => {
                  const studentName = student.profile?.full_name || "Unnamed Scholar";
                  const initials = studentName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                  const hue = studentName.charCodeAt(0) * 7 % 360;

                  return (
                  <tr key={`${student.rowKind}-${student.id}`} className="transition-colors hover:bg-surface-container-low/60">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        {student.profile?.avatar_url ? (
                          <img src={student.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{ background: `hsl(${hue}, 45%, 90%)`, color: `hsl(${hue}, 40%, 40%)` }}
                          >
                            {initials}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {studentName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {student.profile?.phone || student.profile?.email || "No contact info"}
                          </p>
                        </div>
                      </div>
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
                      {student.branch?.name ?? "—"}
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
                  );
                })}
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

          {/* ── Student Migration Dialog ──────────────────────────── */}
          <Dialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  Migrate Students to New Class
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Move all active students from one class to another. Useful at the start of a new academic year to promote an entire batch.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="migrate-source-class" className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Source Class</label>
                  <Select value={migrateSourceClassId} onValueChange={(v) => { setMigrateSourceClassId(v ?? ""); setMigrateError(""); setMigrateSuccess(""); }}>
                    <SelectTrigger id="migrate-source-class"><SelectValue placeholder="Select source class" /></SelectTrigger>
                    <SelectContent>
                      {allClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.board})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {migrateSourceClassId && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{migrateSourceStudentCount}</span> active student{migrateSourceStudentCount !== 1 ? "s" : ""} in this class
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="migrate-target-class" className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Target Class</label>
                  <Select value={migrateTargetClassId} onValueChange={(v) => { setMigrateTargetClassId(v ?? ""); setMigrateError(""); setMigrateSuccess(""); }}>
                    <SelectTrigger id="migrate-target-class"><SelectValue placeholder="Select target class" /></SelectTrigger>
                    <SelectContent>
                      {allClasses.filter((c) => c.id !== migrateSourceClassId).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.board})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors duration-200 hover:bg-muted/40 focus-within:ring-2 focus-within:ring-primary/50">
                  <input
                    type="checkbox"
                    checked={migrateResetFees}
                    onChange={(e) => setMigrateResetFees(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Reset fee status for new year</p>
                    <p className="text-xs text-muted-foreground">Clears all payment flags and sets fee amount to 0</p>
                  </div>
                </label>

                {migrateError && <p className="text-sm text-destructive" role="alert">{migrateError}</p>}
                {migrateSuccess && <p className="text-sm text-emerald-600" role="status">{migrateSuccess}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setMigrateDialogOpen(false)} disabled={migrating} className="cursor-pointer">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleMigrateStudents()}
                    disabled={migrating || !migrateSourceClassId || !migrateTargetClassId || migrateSourceStudentCount === 0 || !!migrateSuccess}
                    aria-label={`Migrate ${migrateSourceStudentCount} students to new class`}
                    className="cursor-pointer gap-2"
                  >
                    {migrating ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ArrowRightLeft className="h-4 w-4" />}
                    {migrateSuccess ? "Done" : `Migrate ${migrateSourceStudentCount} Student${migrateSourceStudentCount !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
