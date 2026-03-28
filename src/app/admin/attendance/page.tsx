"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Check,
  ClipboardCheck,
  Loader2,
  Search,
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
  student_id: string;
  status: AttendanceStatus;
  late_minutes: number | null;
  remarks: string | null;
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

      let attendanceQuery = supabase
        .from("attendance")
        .select("student_id, status, late_minutes, remarks")
        .eq("class_id", selectedClassId)
        .eq("date", date);

      if (selectedCourseId) {
        attendanceQuery = attendanceQuery.eq("course_id", selectedCourseId);
      }

      const studentPromise = cachedStudents
        ? Promise.resolve({ data: cachedStudents, error: null })
        : supabase
            .from("students")
            .select("id, profile:profiles(full_name)")
            .eq("class_id", selectedClassId)
            .eq("is_active", true)
            .order("id");

      const [
        { data: studentData, error: studentError },
        { data: existing, error: attendanceError },
      ] = await Promise.all([studentPromise, attendanceQuery]);

      if (requestId !== requestSequenceRef.current) {
        return;
      }

      if (studentError) {
        throw studentError;
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
          student_id: student.id,
          status: "present",
          late_minutes: null,
          remarks: null,
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

    const rows = records.map((record) => ({
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
      onConflict: "student_id,date",
    });

    setSaving(false);
    if (error) {
      setSaved(false);
      setSaveError(error.message);
      return;
    }
    setSaved(true);
    setEditingSaved(false);
  }

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ?? null;

  const filteredStudents = students.filter((student) =>
    (student.profile?.full_name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase().trim())
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
                  onChange={(event) => setSearch(event.target.value)}
                  className={cn(stitchInputClass, "pl-11")}
                  placeholder="Search students..."
                  disabled={!editingSaved}
                />
              </div>
            </div>

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
                        <p className="mt-2 text-sm text-muted-foreground">Studio Scholar</p>
                      </div>
                      <div className="flex gap-2">
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
