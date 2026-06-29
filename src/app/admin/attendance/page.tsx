"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  ClipboardCheck,
  Clock,
  Download,
  History,
  Loader2,
  RotateCcw,
  Search,
  User,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Class } from "@/lib/types/database";
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
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";
import { invalidateAfterAttendanceSave } from "@/lib/cache-invalidation";
import { buildTeacherSubjectAccessKey } from "@/lib/teacher-subject-access";

type AttendanceStatus = "present" | "absent";

interface StudentForAttendance {
  id: string;
  profile: { full_name: string } | null;
}

interface CourseForAttendance {
  id: string;
  title: string;
  subject: string;
  class_id: string;
  course_id: string | null;
}

interface AttendanceRecord {
  session_id?: string | null;
  student_id: string;
  status: AttendanceStatus;
  late_minutes: number | null;
  remarks: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  scan_method: "manual" | "qr";
}

interface HistoryRow {
  student_id: string;
  date: string;
  status: string;
  late_minutes: number | null;
  remarks: string | null;
  class_name: string;
  course_title: string;
  check_in_at: string | null;
  check_out_at: string | null;
  scan_method: string;
}

interface AllStudentRow {
  id: string;
  profile: { full_name: string } | null;
  class: { name: string } | null;
}

interface AttendanceBaseCache {
  classes: Class[];
  courses: CourseForAttendance[];
}

interface SyllabusSubjectRow {
  class_id: string;
  subject: string;
}

interface AttendanceSessionCache {
  students: StudentForAttendance[];
  records: AttendanceRecord[];
}

const supabase = createClient();

function normalizeSubjectName(subject: string | null | undefined) {
  return (subject ?? "").trim().toLowerCase();
}

function buildSyntheticSubjectId(classId: string, subject: string) {
  return `subject::${classId}::${normalizeSubjectName(subject)}`;
}

function mergeAttendanceSubjects(
  courseRows: Array<{ id: string; title: string; subject: string; class_id: string }>,
  syllabusRows: SyllabusSubjectRow[],
) {
  const merged: CourseForAttendance[] = [];
  const seen = new Set<string>();

  for (const course of courseRows) {
    const key = `${course.class_id}::${normalizeSubjectName(course.subject)}`;
    seen.add(key);
    merged.push({
      id: course.id,
      title: course.title,
      subject: course.subject,
      class_id: course.class_id,
      course_id: course.id,
    });
  }

  for (const row of syllabusRows) {
    const normalizedSubject = normalizeSubjectName(row.subject);
    if (!row.class_id || !normalizedSubject) continue;
    const key = `${row.class_id}::${normalizedSubject}`;
    if (seen.has(key)) continue;
    merged.push({
      id: buildSyntheticSubjectId(row.class_id, row.subject),
      title: row.subject.trim(),
      subject: row.subject.trim(),
      class_id: row.class_id,
      course_id: null,
    });
    seen.add(key);
  }

  return merged.sort((left, right) => left.title.localeCompare(right.title));
}

export default function AdminAttendancePage() {
  const router = useRouter();
  const { role, user, loading: authLoading } = useAuth();
  const attendanceBaseCacheKey =
    role === "teacher" && user?.id ? `admin:attendance:base:teacher:${user.id}` : "admin:attendance:base:admin";
  const [classes, setClasses] = useState<Class[]>(
    () => getAdminPageCache<AttendanceBaseCache>(attendanceBaseCacheKey)?.classes ?? [],
  );
  const [courses, setCourses] = useState<CourseForAttendance[]>(
    () => getAdminPageCache<AttendanceBaseCache>(attendanceBaseCacheKey)?.courses ?? [],
  );
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<StudentForAttendance[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editingSaved, setEditingSaved] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const studentCacheRef = useRef<Record<string, StudentForAttendance[]>>({});
  const requestSequenceRef = useRef(0);

  // ─── Student Attendance History lookup state ─────────────────────
  const [allStudentsList, setAllStudentsList] = useState<AllStudentRow[]>([]);
  const [allStudentsLoaded, setAllStudentsLoaded] = useState(false);
  const [selectedHistoryStudentId, setSelectedHistoryStudentId] = useState<string | null>(null);
  const [selectedHistoryStudentName, setSelectedHistoryStudentName] = useState("");
  const [selectedHistoryStudentClassName, setSelectedHistoryStudentClassName] = useState("");
  const [historyRecords, setHistoryRecords] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedResolvedCourseId = selectedCourse?.course_id ?? null;
  const selectedSubjectName = selectedCourse?.subject?.trim() ?? "";

  useEffect(() => {
    if (authLoading) return;

    if (role === "student") {
      router.push("/dashboard");
      return;
    }

    if (role !== "admin" && role !== "super_admin" && role !== "teacher") return;


    async function loadBaseData() {
      try {
        const cachedBase = getAdminPageStorageCache<AttendanceBaseCache>(attendanceBaseCacheKey);
        if (cachedBase) {
          setClasses(cachedBase.classes);
          setCourses(cachedBase.courses);
        }

        if (role === "teacher" && user?.id) {
          const [{ data: accessRows, error: accessError }, { data: subjectAccessRows, error: subjectAccessError }] = await Promise.all([
            supabase
              .from("teacher_class_access")
              .select("class_id")
              .eq("teacher_profile_id", user.id),
            supabase
              .from("teacher_subject_access")
              .select("class_id, subject")
              .eq("teacher_profile_id", user.id),
          ]);

          if (accessError || subjectAccessError) {
            throw accessError ?? subjectAccessError;
          }

          if (!subjectAccessRows || subjectAccessRows.length === 0) {
            setClasses([]);
            setCourses([]);
            setActionError("No subject access is assigned for this teacher yet.");
            return;
          }

          const allowedSubjectKeys = new Set(
            ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
              buildTeacherSubjectAccessKey(row.class_id, row.subject),
            ),
          );
          const allowedClassIds = new Set(
            ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) => row.class_id),
          );

          if (accessError) {
            throw accessError;
          }

          const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map(
            (row) => row.class_id,
          );

          if (classIds.length === 0) {
            setClasses([]);
            setCourses([]);
            return;
          }

          const [classesRes, coursesRes, syllabusRes] = await Promise.all([
            supabase.from("classes").select("*").in("id", classIds).order("sort_order"),
            supabase
              .from("courses")
              .select("id, title, subject, class_id")
              .eq("is_online_only", false)
              .in("class_id", classIds)
              .order("title"),
            supabase
              .from("syllabus")
              .select("class_id, subject")
              .in("class_id", classIds)
              .order("subject"),
          ]);

          if (classesRes.error) {
            throw classesRes.error;
          }

          if (coursesRes.error) {
            throw coursesRes.error;
          }

          if (syllabusRes.error) {
            throw syllabusRes.error;
          }

          const nextClasses = ((classesRes.data as Class[] | null) ?? []).filter((item) =>
            allowedClassIds.has(item.id),
          );
          const filteredCourseRows = ((coursesRes.data as Array<{ id: string; title: string; subject: string; class_id: string }> | null) ?? []).filter((course) =>
            allowedSubjectKeys.has(buildTeacherSubjectAccessKey(course.class_id, course.subject)),
          );
          const filteredSyllabusRows = ((syllabusRes.data as SyllabusSubjectRow[] | null) ?? []).filter((row) =>
            allowedSubjectKeys.has(buildTeacherSubjectAccessKey(row.class_id, row.subject)),
          );
          const nextCourses = mergeAttendanceSubjects(filteredCourseRows, filteredSyllabusRows);
          setClasses(nextClasses);
          setCourses(nextCourses);
          setAdminPageCache<AttendanceBaseCache>(attendanceBaseCacheKey, {
            classes: nextClasses,
            courses: nextCourses,
          });
          return;
        }

        const [classesRes, coursesRes, syllabusRes] = await Promise.all([
          supabase.from("classes").select("*").order("sort_order"),
          supabase
            .from("courses")
            .select("id, title, subject, class_id")
            .eq("is_online_only", false)
            .order("title"),
          supabase.from("syllabus").select("class_id, subject").order("subject"),
        ]);

        if (classesRes.error) {
          throw classesRes.error;
        }

        if (coursesRes.error) {
          throw coursesRes.error;
        }

        if (syllabusRes.error) {
          throw syllabusRes.error;
        }

        const nextClasses = (classesRes.data as Class[] | null) ?? [];
        const nextCourses = mergeAttendanceSubjects(
          (coursesRes.data as Array<{ id: string; title: string; subject: string; class_id: string }> | null) ?? [],
          (syllabusRes.data as SyllabusSubjectRow[] | null) ?? [],
        );
        setClasses(nextClasses);
        setCourses(nextCourses);
        setAdminPageCache<AttendanceBaseCache>(attendanceBaseCacheKey, {
          classes: nextClasses,
          courses: nextCourses,
        });
      } catch (error) {
        console.error("Failed to load attendance base data:", error);
        setClasses([]);
        setCourses([]);
        setStudents([]);
        setRecords([]);
        setActionError("Unable to load classes and subjects right now.");
      }
    }

    void loadBaseData();
  }, [attendanceBaseCacheKey, authLoading, role, router, user?.id]);

  const classCourses = useMemo(
    () => courses.filter((course) => course.class_id === selectedClassId),
    [courses, selectedClassId],
  );

  useEffect(() => {
    if (!selectedClassId) {
      const nextClassId = classes[0]?.id ?? "";
      setSelectedClassId(nextClassId);
      if (!nextClassId) {
        setStudents([]);
        setRecords([]);
      }
      return;
    }

    const stillValid = classes.some((item) => item.id === selectedClassId);
    if (!stillValid) {
      const nextClassId = classes[0]?.id ?? "";
      setSelectedClassId(nextClassId);
      if (!nextClassId) {
        setStudents([]);
        setRecords([]);
      }
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }
    async function loadBranches() {
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("class_id", selectedClassId)
        .order("name");
      setBranches((data as Array<{ id: string; name: string }> | null) ?? []);
      setSelectedBranchId("");
    }
    void loadBranches();
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setSelectedCourseId("");
      return;
    }

    const currentValueIsValid = classCourses.some((course) => course.id === selectedCourseId);
    if (currentValueIsValid) {
      return;
    }

    if (role === "teacher") {
      setSelectedCourseId(classCourses[0]?.id ?? "");
      return;
    }

    setSelectedCourseId("");
  }, [classCourses, role, selectedClassId, selectedCourseId]);

  const fetchStudents = useCallback(async () => {
    if (role === "teacher" && !selectedCourseId) {
      setStudents([]);
      setRecords([]);
      setLoading(false);
      setActionError("Select your assigned subject before loading attendance.");
      return;
    }

    if (!selectedClassId) {
      setStudents([]);
      setRecords([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestSequenceRef.current;
    const attendanceSessionCacheKey = `admin:attendance:session:${selectedClassId}:${selectedCourseId || "none"}:${selectedBranchId || "none"}:${date}`;
    const cachedSession = getAdminPageStorageCache<AttendanceSessionCache>(attendanceSessionCacheKey);
    if (cachedSession) {
      setStudents(cachedSession.students);
      setRecords(cachedSession.records);
      studentCacheRef.current[selectedClassId] = cachedSession.students;
      setLoading(false);
    } else {
      setLoading(true);
    }
    setSaved(false);
    setSaveError("");
    setActionError("");
    setEditingSaved(true);


    try {
      const cachedStudents = !selectedBranchId ? studentCacheRef.current[selectedClassId] : null;

      let studentQuery = supabase
        .from("students")
        .select("id, profile:profiles(full_name)")
        .eq("class_id", selectedClassId)
        .eq("is_active", true)
        .order("id");
      if (selectedBranchId) {
        studentQuery = studentQuery.eq("branch_id", selectedBranchId);
      }
      const studentPromise = cachedStudents
        ? Promise.resolve({ data: cachedStudents, error: null })
        : studentQuery;

      let sessionQuery = supabase
        .from("attendance_sessions")
        .select("id")
        .eq("class_id", selectedClassId)
        .eq("session_date", date);

      sessionQuery = selectedResolvedCourseId
        ? sessionQuery.eq("course_id", selectedResolvedCourseId)
        : selectedSubjectName
          ? sessionQuery.is("course_id", null).eq("subject", selectedSubjectName)
          : sessionQuery.is("course_id", null);

      const [
        { data: studentData, error: studentError },
        { data: sessionData, error: sessionError },
      ] = await Promise.all([studentPromise, sessionQuery.maybeSingle()]);

      if (requestId !== requestSequenceRef.current) {
        return;
      }

      if (studentError) {
        throw studentError;
      }

      if (sessionError) {
        throw sessionError;
      }

      let attendanceQuery = supabase
        .from("attendance")
        .select("session_id, student_id, status, late_minutes, remarks, check_in_at, check_out_at, scan_method");

      const sessionId = (sessionData as { id?: string } | null)?.id ?? null;

      if (sessionId) {
        attendanceQuery = attendanceQuery.eq("session_id", sessionId);
      } else {
        attendanceQuery = attendanceQuery
          .eq("class_id", selectedClassId)
          .eq("date", date)
          .is("session_id", null);

        attendanceQuery = selectedResolvedCourseId
          ? attendanceQuery.eq("course_id", selectedResolvedCourseId)
          : attendanceQuery.is("course_id", null);
      }

      const { data: existing, error: attendanceError } = await attendanceQuery;

      if (requestId !== requestSequenceRef.current) {
        return;
      }

      if (attendanceError) {
        throw attendanceError;
      }

      const fetchedStudents = ((studentData || []) as unknown as StudentForAttendance[]) ?? [];
      if (!selectedBranchId) {
        studentCacheRef.current[selectedClassId] = fetchedStudents;
      }
      setStudents(fetchedStudents);
      const existingMap = new Map(
        ((existing as AttendanceRecord[] | null) ?? []).map((entry) => [
          entry.student_id,
          entry,
        ]),
      );

      const normalizedRecords = fetchedStudents.map((student) => {
        const found = existingMap.get(student.id);
        const fallback: AttendanceRecord = {
          session_id: sessionId,
          student_id: student.id,
          status: "present",
          late_minutes: null,
          remarks: null,
          check_in_at: null,
          check_out_at: null,
          scan_method: "manual",
        };
        return found ?? fallback;
      });

      setRecords(normalizedRecords);
      setAdminPageCache<AttendanceSessionCache>(attendanceSessionCacheKey, {
        students: fetchedStudents,
        records: normalizedRecords,
      });
      if (((existing as AttendanceRecord[] | null) ?? []).length > 0) {
        setEditingSaved(false);
      }
    } catch (error) {
      console.error("Failed to load attendance students:", error);
      if (requestId === requestSequenceRef.current) {
        setStudents([]);
        setRecords([]);
        setActionError("Unable to load attendance for the selected batch.");
      }
    } finally {
      if (requestId === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [date, role, selectedBranchId, selectedClassId, selectedResolvedCourseId, selectedSubjectName, selectedCourseId]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  function updateRecord(studentId: string, patch: Partial<AttendanceRecord>) {
    setRecords((previous) =>
      previous.map((record) =>
        record.student_id === studentId ? { ...record, ...patch } : record
      )
    );
  }

  function handleMarkAllPresent() {
    if (!selectedClassId || records.length === 0) {
      setActionError("Select a batch with available students before marking attendance.");
      return;
    }

    if (!editingSaved) {
      setActionError("Click Edit Saved Attendance before changing saved records.");
      return;
    }

    setActionError("");
    setRecords((previous) =>
      previous.map((record) => ({
        ...record,
        status: "present",
      }))
    );
  }

  function handleMarkAllAbsent() {
    if (!selectedClassId || records.length === 0) {
      setActionError("Select a batch with available students before marking attendance.");
      return;
    }

    if (!editingSaved) {
      setActionError("Click Edit Saved Attendance before changing saved records.");
      return;
    }

    setActionError("");
    setRecords((previous) =>
      previous.map((record) => ({
        ...record,
        status: "absent",
        late_minutes: null,
      }))
    );
  }

  function handleClearCourse() {
    if (!selectedCourseId) {
      setActionError("Choose a subject first before clearing it.");
      return;
    }

    if (!editingSaved) {
      setActionError("Click Edit Saved Attendance before changing the subject selection.");
      return;
    }

    setActionError("");
    setSelectedCourseId("");
  }

  async function handleResetAttendance() {
    if (!selectedClassId) return;

    setResetDialogOpen(false);
    setResetting(true);
    setSaveError("");
    setActionError("");

    try {
      // 1. Find all sessions for this class
      const { data: sessions, error: fetchError } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("class_id", selectedClassId);

      if (fetchError) throw fetchError;

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);

        // 2. Delete all attendance rows tied to these sessions
        const { error: deleteAttError } = await supabase
          .from("attendance")
          .delete()
          .in("session_id", sessionIds);

        if (deleteAttError) throw deleteAttError;

        // 3. Delete all sessions for this class
        const { error: deleteSessionError } = await supabase
          .from("attendance_sessions")
          .delete()
          .eq("class_id", selectedClassId);

        if (deleteSessionError) throw deleteSessionError;
      }

      // 4. Reset local state to fresh
      setRecords((prev) =>
        prev.map((r) => ({
          ...r,
          session_id: null,
          status: "present" as AttendanceStatus,
          late_minutes: null,
          remarks: null,
          check_in_at: null,
          check_out_at: null,
          scan_method: "manual" as const,
        })),
      );
      setEditingSaved(true);
      setSaved(false);
      invalidateAfterAttendanceSave();
    } catch (err) {
      console.error("Failed to reset attendance:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to reset attendance");
    } finally {
      setResetting(false);
    }
  }

  async function handleSave() {
    if (!selectedClassId || !user?.id || records.length === 0) return;
    if (role === "teacher" && !selectedCourseId) {
      setActionError("Teachers must choose an assigned subject before saving attendance.");
      return;
    }
    setSaveError("");
    setActionError("");
    setSaving(true);


    const sessionResponse = await fetch("/api/attendance/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: selectedClassId,
        courseId: selectedResolvedCourseId,
        subject: selectedSubjectName || null,
        date,
      }),
    });

    const sessionJson = (await sessionResponse.json()) as {
      session?: { id: string };
      error?: string;
    };

    if (!sessionResponse.ok || !sessionJson.session?.id) {
      setSaving(false);
      setSaved(false);
      setSaveError(sessionJson.error ?? "Failed to prepare attendance session");
      return;
    }

    const sessionId = sessionJson.session.id;
    const studentIds = records.map((record) => record.student_id);

    let legacySyncQuery = supabase
      .from("attendance")
      .update({ session_id: sessionId })
      .eq("class_id", selectedClassId)
      .eq("date", date)
      .is("session_id", null)
      .in("student_id", studentIds);

    legacySyncQuery = selectedResolvedCourseId
      ? legacySyncQuery.eq("course_id", selectedResolvedCourseId)
      : legacySyncQuery.is("course_id", null);

    const { error: legacySyncError } = await legacySyncQuery;

    if (legacySyncError) {
      setSaving(false);
      setSaved(false);
      setSaveError(legacySyncError.message);
      return;
    }

    const rows = records.map((record) => ({
      session_id: sessionId,
      student_id: record.student_id,
      class_id: selectedClassId,
      course_id: selectedResolvedCourseId,
      date,
      status: record.status,
      late_minutes:
        record.status === "present" ? record.late_minutes ?? 0 : null,
      remarks: record.remarks?.trim() ? record.remarks.trim() : null,
      marked_by: user.id,
    }));

    const { error } = await supabase.from("attendance").upsert(rows, {
      onConflict: "student_id,session_id",
    });

    setSaving(false);
    if (error) {
      setSaved(false);
      setSaveError(error.message);
      return;
    }
    setSaved(true);
    setEditingSaved(false);
    invalidateAfterAttendanceSave();
    setRecords((previous) =>
      previous.map((record) => ({
        ...record,
        session_id: sessionId,
      })),
    );
  }

  const normalizedSearch = search.toLowerCase().trim();

  const filteredStudents = students.filter((student) =>
    (student.profile?.full_name ?? "").toLowerCase().includes(normalizedSearch)
  );

  const presentCount = records.filter(
    (record) => record.status === "present"
  ).length;
  const absentCount = records.filter(
    (record) => record.status === "absent"
  ).length;
  const lateCount = records.filter(
    (record) => record.status === "present" && (record.late_minutes ?? 0) > 0
  ).length;

  const attendanceExportHeaders = [
    { key: "studentId", label: "Student ID" },
    { key: "name", label: "Student Name" },
    { key: "status", label: "Status" },
    { key: "lateMinutes", label: "Late (min)" },
    { key: "remarks", label: "Remarks" },
    { key: "date", label: "Date" },
    { key: "batch", label: "Batch" },
    { key: "course", label: "Subject" },
    { key: "checkInAt", label: "Check-In Time" },
    { key: "checkOutAt", label: "Check-Out Time" },
    { key: "scanMethod", label: "Scan Method" },
  ];

  function buildAttendanceExportRows() {
    return records.map((record) => {
      const student = students.find((s) => s.id === record.student_id);
      const formatTime = (iso: string | null) =>
        iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "";
      return {
        studentId: record.student_id,
        name: student?.profile?.full_name ?? "Unknown",
        status: record.status === "present" ? "Present" : "Absent",
        lateMinutes: record.status === "present" ? String(record.late_minutes ?? 0) : "",
        remarks: record.remarks ?? "",
        date: new Date(date).toLocaleDateString("en-IN"),
        batch: selectedClass?.name ?? "N/A",
        course: selectedSubjectName || selectedCourse?.title || "General",
        checkInAt: formatTime(record.check_in_at),
        checkOutAt: formatTime(record.check_out_at),
        scanMethod: record.scan_method ?? "manual",
      };
    });
  }

  function handleAttendanceCSV() {
    const batchSlug = (selectedClass?.name ?? "batch").replace(/\s+/g, "_");
    downloadCSV(
      buildAttendanceExportRows(),
      attendanceExportHeaders,
      `attendance_${batchSlug}_${date}`,
    );
  }

  async function handleAttendanceXLSX() {
    const batchSlug = (selectedClass?.name ?? "batch").replace(/\s+/g, "_");
    await downloadXLSX(
      buildAttendanceExportRows(),
      attendanceExportHeaders,
      `attendance_${batchSlug}_${date}`,
    );
  }

  // ─── Student Attendance History functions ────────────────────────

  // Load all students (for the dropdown) on first interaction
  async function loadAllStudents() {
    if (allStudentsLoaded) return;
    const allStudentsCacheKey =
      role === "teacher" && user?.id
        ? `admin:attendance:all-students:teacher:${user.id}`
        : "admin:attendance:all-students:admin";
    const cachedAllStudents = getAdminPageStorageCache<AllStudentRow[]>(allStudentsCacheKey);
    if (cachedAllStudents) {
      setAllStudentsList(cachedAllStudents);
      setAllStudentsLoaded(true);
      return;
    }


    let query = supabase
      .from("students")
      .select("id, profile:profiles(full_name), class:classes(name)")
      .eq("is_active", true)
      .order("id");

    // Teachers only see their assigned classes
    if (role === "teacher" && user?.id) {
      const { data: accessRows } = await supabase
        .from("teacher_subject_access")
        .select("class_id")
        .eq("teacher_profile_id", user.id);
      const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map((r) => r.class_id);
      if (classIds.length === 0) {
        setAllStudentsList([]);
        setAdminPageCache(allStudentsCacheKey, []);
        setAllStudentsLoaded(true);
        return;
      }
      query = query.in("class_id", classIds);
    }

    const { data } = await query;
    const rows = ((data as unknown as AllStudentRow[]) ?? []).sort((left, right) =>
      (left.profile?.full_name ?? "").localeCompare(right.profile?.full_name ?? "", undefined, {
        sensitivity: "base",
      }),
    );
    setAllStudentsList(rows);
    setAdminPageCache(allStudentsCacheKey, rows);
    setAllStudentsLoaded(true);
  }

  async function fetchStudentHistory(studentId: string) {
    setHistoryLoading(true);
    setHistoryRecords([]);


    const { data } = await supabase
      .from("attendance")
      .select("date, status, late_minutes, remarks, check_in_at, check_out_at, scan_method, class_id, course_id, class:classes(name), course:courses(title, subject)")
      .eq("student_id", studentId)
      .order("date", { ascending: false });

    let nextRows = ((data as unknown as Array<{
      date: string;
      status: string;
      late_minutes: number | null;
      remarks: string | null;
      check_in_at: string | null;
      check_out_at: string | null;
      scan_method: string;
      class_id: string;
      course_id: string | null;
      class: { name: string } | null;
      course: { title: string; subject: string } | null;
    }>) ?? []);

    if (role === "teacher" && user?.id) {
      const { data: subjectAccessRows } = await supabase
        .from("teacher_subject_access")
        .select("class_id, subject")
        .eq("teacher_profile_id", user.id);

      const allowedSubjectKeys = new Set(
        ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
          buildTeacherSubjectAccessKey(row.class_id, row.subject),
        ),
      );

      nextRows = nextRows.filter((row) =>
        row.course_id && row.course?.subject
          ? allowedSubjectKeys.has(buildTeacherSubjectAccessKey(row.class_id, row.course.subject))
          : false,
      );
    }

    const rows: HistoryRow[] = nextRows.map((r) => ({
      student_id: studentId,
      date: r.date,
      status: r.status,
      late_minutes: r.late_minutes,
      remarks: r.remarks,
      class_name: r.class?.name ?? "N/A",
      course_title: r.course?.title ?? "General",
      check_in_at: r.check_in_at,
      check_out_at: r.check_out_at,
      scan_method: r.scan_method ?? "manual",
    }));

    setHistoryRecords(rows);
    setHistoryLoading(false);
  }

  function openStudentHistory(studentId: string, studentName: string, className: string) {
    setSelectedHistoryStudentId(studentId);
    setSelectedHistoryStudentName(studentName);
    setSelectedHistoryStudentClassName(className);
    void fetchStudentHistory(studentId);
  }

  function handleSelectHistoryStudent(student: AllStudentRow) {
    openStudentHistory(
      student.id,
      student.profile?.full_name ?? "Unknown",
      student.class?.name ?? "No class",
    );
    setSearch(student.profile?.full_name ?? "");
  }

  function clearHistorySelection(options?: { preserveSearch?: boolean }) {
    setSelectedHistoryStudentId(null);
    setSelectedHistoryStudentName("");
    setSelectedHistoryStudentClassName("");
    setHistoryRecords([]);
    setHistoryLoading(false);
    if (!options?.preserveSearch) {
      setSearch("");
    }
  }

  const historyExportHeaders = [
    { key: "studentId", label: "Student ID" },
    { key: "date", label: "Date" },
    { key: "status", label: "Status" },
    { key: "lateMinutes", label: "Late (min)" },
    { key: "remarks", label: "Remarks" },
    { key: "className", label: "Batch" },
    { key: "courseTitle", label: "Subject" },
    { key: "checkInAt", label: "Check-In Time" },
    { key: "checkOutAt", label: "Check-Out Time" },
    { key: "scanMethod", label: "Scan Method" },
  ];

  function buildHistoryExportRows() {
    const formatTime = (iso: string | null) =>
      iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "";
    return historyRecords.map((r) => ({
      studentId: r.student_id,
      date: new Date(r.date).toLocaleDateString("en-IN"),
      status: r.status === "present" ? "Present" : "Absent",
      lateMinutes: r.status === "present" ? String(r.late_minutes ?? 0) : "",
      remarks: r.remarks ?? "",
      className: r.class_name,
      courseTitle: r.course_title,
      checkInAt: formatTime(r.check_in_at),
      checkOutAt: formatTime(r.check_out_at),
      scanMethod: r.scan_method ?? "manual",
    }));
  }

  function handleHistoryCSV() {
    const slug = selectedHistoryStudentName.replace(/\s+/g, "_") || "student";
    const today = new Date().toISOString().split("T")[0];
    downloadCSV(buildHistoryExportRows(), historyExportHeaders, `${slug}_attendance_${today}`);
  }

  async function handleHistoryXLSX() {
    const slug = selectedHistoryStudentName.replace(/\s+/g, "_") || "student";
    const today = new Date().toISOString().split("T")[0];
    await downloadXLSX(buildHistoryExportRows(), historyExportHeaders, `${slug}_attendance_${today}`);
  }

  const filteredAllStudents = allStudentsList.filter((student) =>
    (student.profile?.full_name ?? "").toLowerCase().includes(normalizedSearch)
  );
  const showHistorySuggestions =
    normalizedSearch.length > 0 &&
    filteredAllStudents.length > 0 &&
    normalizedSearch !== selectedHistoryStudentName.toLowerCase().trim();

  const historyPresentCount = historyRecords.filter((r) => r.status === "present").length;
  const historyAbsentCount = historyRecords.filter((r) => r.status === "absent").length;


  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Session Manager"
        title={
          selectedClassId
            ? classes.find((item) => item.id === selectedClassId)?.name ??
              "Attendance"
            : "Attendance Manager"
        }
        description="Select subject, batch, and date. Mark present/absent, capture late minutes and remarks, and edit historical attendance safely."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className={stitchPanelClass}>
            <div className={cn("grid gap-4", branches.length > 0 ? "md:grid-cols-4" : "md:grid-cols-3")}>
              <Select
                value={selectedCourseId || "__general"}
                onValueChange={(value) =>
                  setSelectedCourseId(value === "__general" ? "" : (value ?? ""))
                }
                disabled={!editingSaved}
              >
                <SelectTrigger>
                  <SelectValue placeholder={role === "teacher" ? "Choose subject" : "General Attendance"}>
                    {selectedCourse
                      ? `${selectedCourse.title} (${selectedCourse.subject})`
                      : role === "teacher" ? "Choose subject" : "General Attendance"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {role === "teacher" ? null : (
                    <SelectItem value="__general">General Attendance (All Subjects)</SelectItem>
                  )}
                  {selectedClassId && classCourses.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No subjects available
                    </SelectItem>
                  ) : null}
                  {classCourses.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title} ({item.subject})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedClassId}
                onValueChange={(value) =>
                  setSelectedClassId(value ?? "")
                }
                disabled={!editingSaved}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a batch">
                    {selectedClass
                      ? `${selectedClass.name} (${selectedClass.board})`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {classes.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No batches available
                    </SelectItem>
                    ) : null}
                  {classes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.board})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {branches.length > 0 ? (
                <Select
                  value={selectedBranchId || "__all"}
                  onValueChange={(value) =>
                    setSelectedBranchId(value === "__all" ? "" : (value ?? ""))
                  }
                  disabled={!editingSaved}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All branches">
                      {selectedBranchId
                        ? branches.find((b) => b.id === selectedBranchId)?.name
                        : "All branches"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={stitchInputClass}
                disabled={!editingSaved}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className={stitchButtonClass}
                onClick={handleMarkAllPresent}
                disabled={!editingSaved || !selectedClassId || records.length === 0}
              >
                Mark All Present
              </button>
              <button
                type="button"
                className={stitchSecondaryButtonClass}
                onClick={handleMarkAllAbsent}
                disabled={!editingSaved || !selectedClassId || records.length === 0}
              >
                Mark All Absent
              </button>
              {selectedClassId && records.length > 0 && (role === "admin" || role === "super_admin") ? (
                <Button
                  onClick={() => setResetDialogOpen(true)}
                  disabled={resetting}
                  variant="outline"
                  size="sm"
                  aria-label="Reset all attendance for this class"
                  className="cursor-pointer gap-2 border-destructive/30 text-destructive transition-colors duration-200 hover:bg-destructive/10"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RotateCcw className="h-4 w-4" />}
                  Reset Attendance
                </Button>
              ) : null}
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSearch(nextValue);
                    if (!allStudentsLoaded) {
                      void loadAllStudents();
                    }

                    if (
                      selectedHistoryStudentId &&
                      nextValue.trim().toLowerCase() !== selectedHistoryStudentName.toLowerCase().trim()
                    ) {
                      clearHistorySelection({ preserveSearch: true });
                    }
                  }}
                  onFocus={() => {
                    if (!allStudentsLoaded) {
                      void loadAllStudents();
                    }
                  }}
                  className={cn(stitchInputClass, "pl-11")}
                  placeholder="Search this batch or choose a student for full history..."
                />
                {showHistorySuggestions ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-60 overflow-y-auto rounded-2xl border border-border bg-card shadow-lg">
                    {filteredAllStudents.slice(0, 8).map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-accent/40"
                        onClick={() => handleSelectHistoryStudent(student)}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {student.profile?.full_name ?? "Unknown"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {student.class?.name ?? "No class"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-primary">
                          History
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Use this search to filter the current batch. Pick a student from the dropdown to open their full attendance history and download it.
            </p>

            {selectedHistoryStudentId ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedHistoryStudentName}</p>
                    <p className="text-xs text-muted-foreground">
                      Viewing full history
                      {selectedHistoryStudentClassName ? ` - ${selectedHistoryStudentClassName}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition hover:text-foreground"
                  onClick={() => clearHistorySelection()}
                >
                  Clear history view
                </button>
              </div>
            ) : null}

            {selectedCourse ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Subject selected: <span className="text-foreground">{selectedCourse.title}</span> ({selectedCourse.subject})
                </p>
                {role === "teacher" ? null : (
                  <button
                    type="button"
                    className={stitchSecondaryButtonClass}
                    onClick={handleClearCourse}
                    disabled={!editingSaved || !selectedCourseId}
                  >
                    Clear Subject
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {role === "teacher"
                  ? "Choose one of your assigned subjects to load attendance for that class."
                  : "Tip: choose a subject to track subject-wise attendance."}
              </p>
            )}
            {actionError ? <p className="mt-4 text-sm text-destructive">{actionError}</p> : null}
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="col-span-full flex min-h-40 items-center justify-center">
                <LoadingAnimation size="md" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className={cn(stitchPanelSoftClass, "text-center")}>
                <h3 className="text-2xl text-foreground">No students found</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {normalizedSearch
                    ? `No students in this batch match "${search.trim()}".`
                    : "No students are available for the selected batch and date."}
                </p>
              </div>
            ) : (
              filteredStudents.map((student) => {
                const record = records.find((item) => item.student_id === student.id);
                const isPresent = record?.status === "present";

                return (
                  <div
                    key={student.id}
                    className={cn(
                      stitchPanelSoftClass,
                      "relative text-left transition-all hover:shadow-[0_8px_24px_-16px_rgba(26,28,29,0.12)]",
                      isPresent
                        ? "border-l-[3px] border-l-emerald-500 border-t-black/5 border-r-black/5 border-b-black/5"
                        : "border-l-[3px] border-l-rose-400 border-t-black/5 border-r-black/5 border-b-black/5"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {(() => {
                          const studentName = student.profile?.full_name ?? "Unknown";
                          const initials = studentName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                          const hue = studentName.charCodeAt(0) * 7 % 360;
                          return (
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                              style={{ background: `hsl(${hue}, 45%, 90%)`, color: `hsl(${hue}, 40%, 40%)` }}
                            >
                              {initials}
                            </div>
                          );
                        })()}
                        <div>
                          <h3 className="text-xl text-foreground sm:text-2xl">
                            {student.profile?.full_name ?? "Unknown"}
                          </h3>
                          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <UserCheck className="h-3.5 w-3.5" /> Present
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-500">
                                <UserX className="h-3.5 w-3.5" /> Absent
                              </span>
                            )}
                            {record?.scan_method === "qr" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-blue-500">
                                QR
                              </span>
                            )}
                          </p>
                        {record?.check_in_at && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(record.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
                            {record.check_out_at && (
                              <> → {new Date(record.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}</>
                            )}
                          </p>
                        )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openStudentHistory(
                              student.id,
                              student.profile?.full_name ?? "Unknown",
                              selectedClass?.name ?? "No class",
                            )
                          }
                          className={cn(
                            stitchSecondaryButtonClass,
                            "h-8 px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
                          )}
                        >
                          <History className="h-3.5 w-3.5" />
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateRecord(student.id, {
                              status: "present",
                            })
                          }
                          className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                            isPresent
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                          disabled={!editingSaved}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateRecord(student.id, {
                              status: "absent",
                              late_minutes: null,
                            })
                          }
                          className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                            !isPresent
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                          disabled={!editingSaved}
                        >
                          Absent
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr]">
                      <div>
                        <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Late (minutes)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={record?.late_minutes ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value;
                            updateRecord(student.id, {
                              late_minutes:
                                raw.trim() === "" ? null : Number.parseInt(raw, 10) || 0,
                              status: "present",
                            });
                          }}
                          disabled={!isPresent || !editingSaved}
                          readOnly={!editingSaved}
                          className={stitchInputClass}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Remarks
                        </label>
                        <input
                          value={record?.remarks ?? ""}
                          onChange={(event) =>
                            updateRecord(student.id, {
                              remarks: event.target.value,
                            })
                          }
                          className={stitchInputClass}
                          placeholder="Optional note"
                          readOnly={!editingSaved}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-1">
          <div className={stitchPanelClass}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <h3 className="text-2xl text-foreground">Session Summary</h3>
            </div>
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">{new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Batch</span>
                <span className="font-medium text-foreground">{classes.find((item) => item.id === selectedClassId)?.name ?? "Not selected"}</span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subject</span>
                <span className="font-medium text-foreground">{selectedCourse?.title ?? "General"}</span>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "flex-1 gap-2")}
                onClick={handleAttendanceCSV}
                disabled={records.length === 0}
                title="Download attendance as CSV"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "flex-1 gap-2")}
                onClick={() => void handleAttendanceXLSX()}
                disabled={records.length === 0}
                title="Download attendance as Excel"
              >
                <Download className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>
          <div className={stitchPanelClass}>
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <h3 className="text-3xl text-foreground">Student History</h3>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {selectedHistoryStudentId
                ? "Full attendance archive for the selected student."
                : "Choose a student from the main search box to view their full attendance history and download it."}
            </p>

            {!selectedHistoryStudentId ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Start typing a student name in the search box above, then choose the student marked with the history option.
              </div>
            ) : null}

            {selectedHistoryStudentId && (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedHistoryStudentName}</p>
                      <p className="text-xs text-muted-foreground">{selectedHistoryStudentClassName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                    onClick={() => clearHistorySelection()}
                  >
                    Clear
                  </button>
                </div>

                {historyLoading ? (
                  <div className="mt-4 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : historyRecords.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No attendance records found for this student.</p>
                ) : (
                  <>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Check className="h-3 w-3" /> {historyPresentCount} present
                      </span>
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <X className="h-3 w-3" /> {historyAbsentCount} absent
                      </span>
                      <span className="text-muted-foreground">{historyRecords.length} total</span>
                    </div>

                    <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Late</th>
                            <th className="px-3 py-2">In/Out</th>
                            <th className="px-3 py-2">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {historyRecords.map((row, index) => (
                            <tr key={`${row.date}-${index}`}>
                              <td className="px-3 py-2 text-foreground">
                                {new Date(row.date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-3 py-2">
                                <span className={row.status === "present" ? "text-primary" : "text-destructive"}>
                                  {row.status === "present" ? "Present" : "Absent"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {row.status === "present" && (row.late_minutes ?? 0) > 0 ? `${row.late_minutes}m` : "-"}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {row.check_in_at
                                  ? new Date(row.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
                                  : "-"}
                                {row.check_out_at && (
                                  <> → {new Date(row.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}</>
                                )}
                                {row.scan_method === "qr" && (
                                  <span className="ml-1 text-[9px] uppercase text-blue-500">QR</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {row.remarks || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className={cn(stitchSecondaryButtonClass, "flex-1 gap-2")}
                        onClick={handleHistoryCSV}
                      >
                        <Download className="h-4 w-4" />
                        CSV
                      </button>
                      <button
                        type="button"
                        className={cn(stitchSecondaryButtonClass, "flex-1 gap-2")}
                        onClick={() => void handleHistoryXLSX()}
                      >
                        <Download className="h-4 w-4" />
                        Excel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={stitchPanelClass}>
            <h3 className="text-3xl text-foreground">Reporting Tip</h3>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Monthly summaries and low-attendance alerts become more accurate when attendance is tagged with the relevant subject.
            </p>
          </div>

          <div className={stitchPanelClass}>
            <p className="stitch-kicker">Today&apos;s Stats</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="font-heading text-2xl text-emerald-600">{presentCount}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-emerald-600/70">Present</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-center">
                <p className="font-heading text-2xl text-rose-600">{absentCount}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-rose-600/70">Absent</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-center">
                <p className="font-heading text-2xl text-amber-600">{lateCount}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-amber-600/70">Late</p>
              </div>
            </div>
            {records.length > 0 && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="flex h-full">
                  <div className="h-full bg-emerald-500/60 transition-all duration-500" style={{ width: `${Math.round((presentCount / records.length) * 100)}%` }} />
                  <div className="h-full bg-rose-400/60 transition-all duration-500" style={{ width: `${Math.round((absentCount / records.length) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {records.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur-md shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3 md:px-10">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Check className="h-3.5 w-3.5" /> {presentCount}
              </span>
              <span className="inline-flex items-center gap-1.5 text-destructive">
                <X className="h-3.5 w-3.5" /> {absentCount}
              </span>
              {lateCount > 0 && <span>{lateCount} late</span>}
              {saveError ? <span className="text-destructive" role="alert">{saveError}</span> : null}
            </div>
            <div className="flex items-center gap-3">
              {selectedClassId && records.length > 0 && (role === "admin" || role === "super_admin") ? (
                <Button
                  onClick={() => setResetDialogOpen(true)}
                  disabled={resetting}
                  variant="outline"
                  size="sm"
                  aria-label="Reset all attendance for this class"
                  className="cursor-pointer gap-2 border-destructive/30 text-destructive transition-colors duration-200 hover:bg-destructive/10"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RotateCcw className="h-4 w-4" />}
                  Reset Attendance
                </Button>
              ) : null}
              {!editingSaved ? (
                <Button
                  onClick={() => {
                    setEditingSaved(true);
                    setSaved(false);
                    setSaveError("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Edit Saved Attendance
                </Button>
              ) : null}
              <Button
                onClick={handleSave}
                disabled={saving || !selectedClassId || records.length === 0 || !editingSaved || (role === "teacher" && !selectedCourseId)}
                className="gap-2"
                size="sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                {saved ? "Saved" : "Save Attendance"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Attendance Confirmation Dialog ──────────────── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </span>
              Reset All Attendance
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This will <span className="font-semibold text-destructive">permanently delete</span> every
              attendance record across <span className="font-semibold text-foreground">all dates</span> for{" "}
              <span className="font-semibold text-foreground">
                {classes.find((c) => c.id === selectedClassId)?.name ?? "this class"}
              </span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleResetAttendance()}
              disabled={resetting}
              className="cursor-pointer gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <AlertTriangle className="h-4 w-4" />}
              {resetting ? "Resetting…" : "Yes, Reset Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
