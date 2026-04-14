"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Check,
  ClipboardCheck,
  Download,
  History,
  Loader2,
  Search,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function AdminAttendancePage() {
  const router = useRouter();
  const { role, user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<CourseForAttendance[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
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

  useEffect(() => {
    if (role === "student") {
      router.push("/dashboard");
      return;
    }

    if (role !== "admin" && role !== "teacher") return;
    const supabase = createClient();

    async function loadBaseData() {
      try {
        if (role === "teacher" && user?.id) {
          const { data: accessRows, error: accessError } = await supabase
            .from("teacher_class_access")
            .select("class_id")
            .eq("teacher_profile_id", user.id);

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

          const [classesRes, coursesRes] = await Promise.all([
            supabase.from("classes").select("*").in("id", classIds).order("sort_order"),
            supabase
              .from("courses")
              .select("id, title, subject, class_id")
              .in("class_id", classIds)
              .order("title"),
          ]);

          if (classesRes.error) {
            throw classesRes.error;
          }

          if (coursesRes.error) {
            throw coursesRes.error;
          }

          setClasses((classesRes.data as Class[] | null) ?? []);
          setCourses((coursesRes.data as CourseForAttendance[] | null) ?? []);
          return;
        }

        const [classesRes, coursesRes] = await Promise.all([
          supabase.from("classes").select("*").order("sort_order"),
          supabase
            .from("courses")
            .select("id, title, subject, class_id")
            .order("title"),
        ]);

        if (classesRes.error) {
          throw classesRes.error;
        }

        if (coursesRes.error) {
          throw coursesRes.error;
        }

        setClasses((classesRes.data as Class[] | null) ?? []);
        setCourses((coursesRes.data as CourseForAttendance[] | null) ?? []);
      } catch (error) {
        console.error("Failed to load attendance base data:", error);
        setClasses([]);
        setCourses([]);
        setStudents([]);
        setRecords([]);
        setActionError("Unable to load classes and courses right now.");
      }
    }

    void loadBaseData();
  }, [role, router, user?.id]);

  const selectableClasses = useMemo(() => {
    if (!selectedCourseId) {
      return classes;
    }

    const allowedClassIds = new Set(
      courses
        .filter((course) => course.id === selectedCourseId)
        .map((course) => course.class_id)
    );

    return classes.filter((item) => allowedClassIds.has(item.id));
  }, [classes, courses, selectedCourseId]);

  useEffect(() => {
    const nextClassId = selectableClasses[0]?.id ?? "";
    const stillValid = selectableClasses.some((item) => item.id === selectedClassId);

    if (!selectedClassId) {
      setSelectedClassId(nextClassId);
      if (!nextClassId) {
        setStudents([]);
        setRecords([]);
      }
      return;
    }

    if (!stillValid) {
      setSelectedClassId(nextClassId);
      if (!nextClassId) {
        setStudents([]);
        setRecords([]);
      }
    }
  }, [selectableClasses, selectedClassId]);

  const fetchStudents = useCallback(async () => {
    if (!selectedClassId) {
      setStudents([]);
      setRecords([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestSequenceRef.current;
    setLoading(true);
    setSaved(false);
    setSaveError("");
    setActionError("");
    setEditingSaved(true);
    const supabase = createClient();

    try {
      const cachedStudents = studentCacheRef.current[selectedClassId];

      const studentPromise = cachedStudents
        ? Promise.resolve({ data: cachedStudents, error: null })
        : supabase
            .from("students")
            .select("id, profile:profiles(full_name)")
            .eq("class_id", selectedClassId)
            .eq("is_active", true)
            .order("id");

      let sessionQuery = supabase
        .from("attendance_sessions")
        .select("id")
        .eq("class_id", selectedClassId)
        .eq("session_date", date);

      sessionQuery = selectedCourseId
        ? sessionQuery.eq("course_id", selectedCourseId)
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

      if ((sessionData as { id?: string } | null)?.id) {
        attendanceQuery = attendanceQuery.eq("session_id", sessionData.id);
      } else {
        attendanceQuery = attendanceQuery
          .eq("class_id", selectedClassId)
          .eq("date", date)
          .is("session_id", null);

        attendanceQuery = selectedCourseId
          ? attendanceQuery.eq("course_id", selectedCourseId)
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
      studentCacheRef.current[selectedClassId] = fetchedStudents;
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
          session_id: (sessionData as { id?: string } | null)?.id ?? null,
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
  }, [selectedClassId, date, selectedCourseId]);

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
      setActionError("Choose a course first before clearing it.");
      return;
    }

    if (!editingSaved) {
      setActionError("Click Edit Saved Attendance before changing the course selection.");
      return;
    }

    setActionError("");
    setSelectedCourseId("");
  }

  async function handleSave() {
    if (!selectedClassId || !user?.id || records.length === 0) return;
    setSaveError("");
    setActionError("");
    setSaving(true);
    const supabase = createClient();

    const sessionResponse = await fetch("/api/attendance/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: selectedClassId,
        courseId: selectedCourseId || null,
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

    legacySyncQuery = selectedCourseId
      ? legacySyncQuery.eq("course_id", selectedCourseId)
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
      course_id: selectedCourseId || null,
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
    setRecords((previous) =>
      previous.map((record) => ({
        ...record,
        session_id: sessionId,
      })),
    );
  }

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ?? null;

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
    { key: "name", label: "Student Name" },
    { key: "status", label: "Status" },
    { key: "lateMinutes", label: "Late (min)" },
    { key: "remarks", label: "Remarks" },
    { key: "date", label: "Date" },
    { key: "batch", label: "Batch" },
    { key: "course", label: "Course" },
  ];

  function buildAttendanceExportRows() {
    return records.map((record) => {
      const student = students.find((s) => s.id === record.student_id);
      return {
        name: student?.profile?.full_name ?? "Unknown",
        status: record.status === "present" ? "Present" : "Absent",
        lateMinutes: record.status === "present" ? String(record.late_minutes ?? 0) : "",
        remarks: record.remarks ?? "",
        date: new Date(date).toLocaleDateString("en-IN"),
        batch: selectedClass?.name ?? "N/A",
        course: selectedCourse?.title ?? "General",
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
    const supabase = createClient();

    let query = supabase
      .from("students")
      .select("id, profile:profiles(full_name), class:classes(name)")
      .eq("is_active", true)
      .order("id");

    // Teachers only see their assigned classes
    if (role === "teacher" && user?.id) {
      const { data: accessRows } = await supabase
        .from("teacher_class_access")
        .select("class_id")
        .eq("teacher_profile_id", user.id);
      const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map((r) => r.class_id);
      if (classIds.length === 0) {
        setAllStudentsList([]);
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
    setAllStudentsLoaded(true);
  }

  async function fetchStudentHistory(studentId: string) {
    setHistoryLoading(true);
    setHistoryRecords([]);
    const supabase = createClient();

    const { data } = await supabase
      .from("attendance")
      .select("date, status, late_minutes, remarks, check_in_at, check_out_at, scan_method, class:classes(name), course:courses(title)")
      .eq("student_id", studentId)
      .order("date", { ascending: false });

    const rows: HistoryRow[] = ((data as unknown as Array<{
      date: string;
      status: string;
      late_minutes: number | null;
      remarks: string | null;
      check_in_at: string | null;
      check_out_at: string | null;
      scan_method: string;
      class: { name: string } | null;
      course: { title: string } | null;
    }>) ?? []).map((r) => ({
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
    { key: "date", label: "Date" },
    { key: "status", label: "Status" },
    { key: "lateMinutes", label: "Late (min)" },
    { key: "remarks", label: "Remarks" },
    { key: "className", label: "Batch" },
    { key: "courseTitle", label: "Course" },
  ];

  function buildHistoryExportRows() {
    return historyRecords.map((r) => ({
      date: new Date(r.date).toLocaleDateString("en-IN"),
      status: r.status === "present" ? "Present" : "Absent",
      lateMinutes: r.status === "present" ? String(r.late_minutes ?? 0) : "",
      remarks: r.remarks ?? "",
      className: r.class_name,
      courseTitle: r.course_title,
    }));
  }

  function handleHistoryCSV() {
    const slug = selectedHistoryStudentName.replace(/\s+/g, "_") || "student";
    downloadCSV(buildHistoryExportRows(), historyExportHeaders, `attendance_history_${slug}`);
  }

  async function handleHistoryXLSX() {
    const slug = selectedHistoryStudentName.replace(/\s+/g, "_") || "student";
    await downloadXLSX(buildHistoryExportRows(), historyExportHeaders, `attendance_history_${slug}`);
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
        description="Select course, batch, and date. Mark present/absent, capture late minutes and remarks, and edit historical attendance safely."
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className={stitchPanelClass}>
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                value={selectedCourseId}
                onValueChange={(value) =>
                  setSelectedCourseId(value ?? "")
                }
                disabled={!editingSaved}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a course (optional)">
                    {selectedCourse
                      ? `${selectedCourse.title} (${selectedCourse.subject})`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {courses.map((item) => (
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
                  {selectableClasses.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No batches available
                    </SelectItem>
                  ) : null}
                  {selectableClasses.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.board})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                  Course selected: <span className="text-foreground">{selectedCourse.title}</span> ({selectedCourse.subject})
                </p>
                <button
                  type="button"
                  className={stitchSecondaryButtonClass}
                  onClick={handleClearCourse}
                  disabled={!editingSaved || !selectedCourseId}
                >
                  Clear Course
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Tip: choose a course to track subject-wise attendance.
              </p>
            )}
            {actionError ? <p className="mt-4 text-sm text-destructive">{actionError}</p> : null}
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="col-span-full flex min-h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                      "text-left transition",
                      isPresent ? "border-primary/12" : "border-destructive/14"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl text-foreground">
                          {student.profile?.full_name ?? "Unknown"}
                        </h3>
                        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          Studio Scholar
                          {record?.scan_method === "qr" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-blue-500">
                              QR
                            </span>
                          )}
                        </p>
                        {record?.check_in_at && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            In: {new Date(record.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
                            {record.check_out_at && (
                              <> → Out: {new Date(record.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}</>
                            )}
                          </p>
                        )}
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

        <div className="space-y-6">
          <div className={stitchPanelClass}>
            <h3 className="text-4xl text-foreground">Session Summary</h3>
            <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
              <p>Date: {new Date(date).toLocaleDateString("en-IN")}</p>
              <p>Batch: {classes.find((item) => item.id === selectedClassId)?.name ?? "Not selected"}</p>
              <p>Course: {selectedCourse?.title ?? "General"}</p>
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
              Monthly summaries and low-attendance alerts become more accurate when attendance is tagged with the relevant course.
            </p>
          </div>

          <div className={stitchPanelClass}>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-primary">
                <Check className="h-4 w-4" /> {presentCount} present
              </span>
              <span className="inline-flex items-center gap-2 text-destructive">
                <X className="h-4 w-4" /> {absentCount} absent
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{lateCount} marked late today</p>
            {saveError ? <p className="mt-4 text-sm text-destructive">{saveError}</p> : null}
            {!editingSaved ? (
              <Button
                onClick={() => {
                  setEditingSaved(true);
                  setSaved(false);
                  setSaveError("");
                }}
                variant="outline"
                className="mt-6 w-full"
              >
                Edit Saved Attendance
              </Button>
            ) : null}
            <Button onClick={handleSave} disabled={saving || !selectedClassId || records.length === 0 || !editingSaved} className="mt-3 w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              {saved ? "Saved" : "Save Attendance"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
