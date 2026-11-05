"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Suspense, useCallback, useEffect, useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  Users,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  StatStrip,
  StitchEmptyState,
  stitchButtonClass,
  stitchInputClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const StudentFormDialog = dynamic(() => import("@/components/admin/student-form-dialog").then(mod => ({ default: mod.StudentFormDialog })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div></div>
});

const CsvUploadDialog = dynamic(() => import("@/components/admin/csv-upload-dialog").then(mod => ({ default: mod.CsvUploadDialog })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin"></div></div>
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
    const { downloadCSV } = await import("@/lib/export-utils");
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
    const { downloadXLSX } = await import("@/lib/export-utils");
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
    const { generateStudentFormPDF } = await import("@/lib/student-form-pdf");
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
  const editStudentForDialog =
    editingStudent?.rowKind === "enrolled" && editingStudent.class_id
      ? {
          ...editingStudent,
          class_id: editingStudent.class_id,
        }
      : null;

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-primary md:text-4xl">{isTeacherView ? "My students" : "Students"}</h1>
          <p className="mt-1 text-muted-foreground">
            {isTeacherView
              ? "Students in your assigned classes. Administrators manage enrollment and fees."
              : "Search, enroll, and manage students, classes, and fees."}
          </p>
        </div>
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
            <Plus aria-hidden="true" className="h-4 w-4" />
            Enroll student
          </button>
        )}
      </div>

      <StatStrip
        className="mt-6"
        items={[
          { label: pendingCount > 0 ? `Students, ${pendingCount} pending` : "Students", value: students.length },
          { label: "Fully paid", value: feesPaidCount, tone: "success" },
          { label: "Part paid", value: feesPartialCount, tone: "warning" },
          { label: "Not paid", value: feesNotPaidCount, tone: "destructive" },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Filter students"
            className={cn(stitchInputClass, "pl-9 pr-16")}
            placeholder="Filter by name, phone, email, or subject"
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-secondary">
              Clear
            </button>
          ) : null}
        </div>

        {filterClasses.length > 0 ? (
          <Select
            value={selectedClassFilterId || "__all"}
            onValueChange={(v) => setSelectedClassFilterId(v === "__all" ? "" : (v ?? ""))}
          >
            <SelectTrigger aria-label="Filter by class">
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
        ) : null}

        {filterBranches.length > 0 ? (
          <Select
            value={selectedBranchFilterId || "__all"}
            onValueChange={(v) => setSelectedBranchFilterId(v === "__all" ? "" : (v ?? ""))}
          >
            <SelectTrigger aria-label="Filter by branch">
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

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(stitchSecondaryButtonClass, "gap-2")}>
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {isTeacherView ? null : (
              <>
                <DropdownMenuItem onClick={() => setCsvDialogOpen(true)}>
                  <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
                  Bulk upload
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openMigrateDialog}>
                  <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
                  Move to another class
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem disabled={filtered.length === 0} onClick={() => void handleDownloadCSV()}>
              <Download aria-hidden="true" className="h-4 w-4" />
              Download CSV
            </DropdownMenuItem>
            <DropdownMenuItem disabled={filtered.length === 0} onClick={() => void handleDownloadXLSX()}>
              <Download aria-hidden="true" className="h-4 w-4" />
              Download Excel
            </DropdownMenuItem>
            <DropdownMenuItem disabled={filtered.length === 0} onClick={() => void handleDownloadForm()}>
              <FileText aria-hidden="true" className="h-4 w-4" />
              Download forms (PDF)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={Users}
            title="No students found"
            description="Try a different search or filter. New sign-ups and enrolled students appear here."
          />
        </div>
      ) : (
        <>
          <div className="stitch-panel mt-4 overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,1.5fr)_7rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5rem] gap-4 border-b px-5 py-3 text-sm font-medium text-muted-foreground lg:grid">
              <span>Student</span>
              <span>Student ID</span>
              <span>Class</span>
              <span>Access</span>
              <span>Fees</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y">
              {filtered.map((student, index) => {
                const studentName = student.profile?.full_name || "Unnamed student";
                const initials = studentName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                const pending = student.rowKind === "pending";
                const courseTitles = (student.enrollments ?? [])
                  .filter((entry) => entry.status === "active")
                  .map((entry) => entry.course?.title)
                  .filter((value): value is string => Boolean(value))
                  .join(", ");

                return (
                  <li
                    key={`${student.rowKind}-${student.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-(--duration-fast) hover:bg-surface-container-low lg:grid-cols-[minmax(0,1.5fr)_7rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5rem] lg:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {student.profile?.avatar_url ? (
                        <img src={student.profile.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-xs font-bold text-primary">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{studentName}</p>
                        <p className="tnum truncate text-sm text-muted-foreground">
                          {student.profile?.phone || student.profile?.email || "No contact info"}
                        </p>
                      </div>
                    </div>

                    <p className="tnum order-last col-span-2 hidden text-sm text-muted-foreground lg:order-none lg:col-span-1 lg:block">
                      {student.enrollment_date
                        ? `STC-${new Date(student.enrollment_date).getFullYear()}-${String(index + 1).padStart(3, "0")}`
                        : "Pending"}
                    </p>

                    <div className="order-last col-span-2 min-w-0 text-sm lg:order-none lg:col-span-1">
                      <p className="truncate font-medium text-foreground">{student.class?.name ?? "No class assigned"}</p>
                      <p className="truncate text-muted-foreground">
                        {[student.class?.board, student.branch?.name].filter(Boolean).join(", ") || "Board pending"}
                      </p>
                    </div>

                    <div className="order-last col-span-2 min-w-0 text-sm lg:order-none lg:col-span-1">
                      <Badge variant={pending ? "warning" : student.is_active ? "secondary" : "warning"}>
                        {pending ? "Waiting to enroll" : student.student_type === "tuition" ? "Tuition" : "Online"}
                        {!pending && !student.is_active ? ", in review" : ""}
                      </Badge>
                      {!pending && student.student_type === "online" ? (
                        <p className="mt-1 truncate text-muted-foreground">{courseTitles || "No online course"}</p>
                      ) : null}
                    </div>

                    <div className="order-last col-span-2 min-w-0 text-sm lg:order-none lg:col-span-1">
                      {pending ? (
                        <p className="text-muted-foreground">Added after enrollment</p>
                      ) : (
                        <>
                          <Badge variant={isFullyPaid(student) ? "success" : isPartiallyPaid(student) ? "warning" : "destructive"}>
                            {getFeesStatusLabel(student)}
                          </Badge>
                          <p className="tnum mt-1 text-muted-foreground">
                            {student.fees_amount > 0 ? `₹${student.fees_amount.toLocaleString("en-IN")}` : ""}
                            {hasFullPaymentMarked(student) ? " in one payment" : ""}
                          </p>
                        </>
                      )}
                    </div>

                    {isTeacherView ? (
                      <span className="sr-only">Read only</span>
                    ) : (
                      <button
                        type="button"
                        className={cn(stitchSecondaryButtonClass, "min-h-9 px-3")}
                        aria-label={`${pending ? "Enroll" : "Edit"} ${studentName}`}
                        onClick={() => {
                          if (pending) {
                            setEditingStudent(null);
                            setInitialProfileId(student.profile_id);
                          } else {
                            setEditingStudent(student);
                            setInitialProfileId(null);
                          }
                          setDialogOpen(true);
                        }}
                      >
                        {pending ? "Enroll" : "Edit"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
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
                  <label htmlFor="migrate-source-class" className="mb-2 block text-xs text-muted-foreground">Source Class</label>
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
                  <label htmlFor="migrate-target-class" className="mb-2 block text-xs text-muted-foreground">Target Class</label>
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
                {migrateSuccess && <p className="text-sm text-success" role="status">{migrateSuccess}</p>}

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
