"use client";

import { useCallback, useEffect, useState } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, GripVertical, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import type { BoardType, Class, ClassLevel } from "@/lib/types/database";
import { downloadCSV, downloadXLSX } from "@/lib/export-utils";
import {
  StitchEmptyState,
  StitchSectionHeader,
  stitchButtonClass,
  stitchPanelClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { getAdminPageCache, getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";
import {
  buildStudentExportRows,
  studentExportHeaders,
  type StudentAttendanceSummary,
} from "@/lib/student-export";

const BOARDS: BoardType[] = ["GSEB", "CBSE"];
const LEVELS: ClassLevel[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "SSC", "HSC"];
const DEFAULT_CLASS_CAPACITY = 30;
const PRIMARY_LEVELS = new Set<ClassLevel>(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const DEFAULT_SEEDED_CAPACITY = 30;
const DEFAULT_CLASS_LEVEL_SEEDS: ClassLevel[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
type DivisionFilter = "all" | "primary" | "senior";
type BoardFilter = "all" | BoardType;

interface StudentCountRow {
  class_id: string;
  is_active: boolean;
}

interface ClassTeacherRow {
  class_id: string;
  teacher: { name: string } | null;
}

interface ClassSubjectRow {
  class_id: string;
  subject: string;
}

const supabase = createClient();
const CLASSES_CACHE_KEY = "admin:classes-overview";

interface ClassesOverviewCache {
  classes: Class[];
  studentCounts: Record<string, number>;
  teacherNamesByClass: Record<string, string[]>;
  subjectsByClass: Record<string, string[]>;
}

function AdminClassesPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, user, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<Class[]>(
    () => getAdminPageCache<ClassesOverviewCache>(CLASSES_CACHE_KEY)?.classes ?? [],
  );
  const [loading, setLoading] = useState(
    () => getAdminPageCache<ClassesOverviewCache>(CLASSES_CACHE_KEY) === null,
  );
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formName, setFormName] = useState("");
  const [formBoard, setFormBoard] = useState<BoardType>("GSEB");
  const [formLevel, setFormLevel] = useState<ClassLevel>("1");
  const [formCapacity, setFormCapacity] = useState(String(DEFAULT_CLASS_CAPACITY));
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>(
    () => getAdminPageCache<ClassesOverviewCache>(CLASSES_CACHE_KEY)?.studentCounts ?? {},
  );
  const [teacherNamesByClass, setTeacherNamesByClass] = useState<Record<string, string[]>>(
    () => getAdminPageCache<ClassesOverviewCache>(CLASSES_CACHE_KEY)?.teacherNamesByClass ?? {},
  );
  const [subjectsByClass, setSubjectsByClass] = useState<Record<string, string[]>>(
    () => getAdminPageCache<ClassesOverviewCache>(CLASSES_CACHE_KEY)?.subjectsByClass ?? {},
  );
  const [formError, setFormError] = useState("");
  const [formSubjectInput, setFormSubjectInput] = useState("");
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>("all");
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [draggingClassId, setDraggingClassId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [exportingClassId, setExportingClassId] = useState<string | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  function normalizeSubject(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  function addFormSubject(rawValue: string) {
    const value = normalizeSubject(rawValue);
    if (!value) return;
    setFormSubjects((current) => (current.includes(value) ? current : [...current, value]));
    setFormSubjectInput("");
  }

  function removeFormSubject(subject: string) {
    setFormSubjects((current) => current.filter((item) => item !== subject));
  }

  async function exportClassStudents(classId: string, className: string, format: "csv" | "xlsx") {
    setExportingClassId(classId);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, profile_id, enrollment_date, is_active, student_type, fees_amount, fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid, profile:profiles(full_name, phone, email, avatar_url), class:classes(name, board), enrollments(status, course:courses(title))")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const typedRows = ((data ?? []) as Array<{
        id: string;
        profile_id: string;
        enrollment_date: string;
        is_active: boolean;
        student_type: "tuition" | "online";
        fees_amount: number;
        fees_full_payment_paid: boolean;
        fees_installment1_paid: boolean;
        fees_installment2_paid: boolean;
        profile: { full_name: string; phone: string; email?: string | null; avatar_url?: string | null } | null;
        class: { name: string; board: string } | null;
        enrollments?: Array<{ status: string; course: { title: string } | null }> | null;
      }>).map((student) => ({
        ...student,
        rowKind: "enrolled" as const,
      }));

      const studentIds = typedRows.map((student) => student.id);
      const attendanceByStudentId: Record<string, StudentAttendanceSummary> = {};
      if (studentIds.length > 0) {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("student_id, status, date")
          .in("student_id", studentIds)
          .order("date", { ascending: false });

        if (attendanceError) {
          throw attendanceError;
        }

        for (const row of ((attendanceData as Array<{ student_id: string; status: string; date: string }> | null) ?? [])) {
          if (!attendanceByStudentId[row.student_id]) {
            attendanceByStudentId[row.student_id] = {
              presentCount: 0,
              absentCount: 0,
              totalSessions: 0,
              lastAttendanceDate: row.date,
            };
          }
          attendanceByStudentId[row.student_id].totalSessions += 1;
          if (row.status === "present") {
            attendanceByStudentId[row.student_id].presentCount += 1;
          } else {
            attendanceByStudentId[row.student_id].absentCount += 1;
          }
        }
      }

      const rows = buildStudentExportRows(typedRows, attendanceByStudentId);

      const filename = `${className.replace(/\s+/g, "_")}_students_${new Date().toISOString().split("T")[0]}`;
      if (format === "csv") {
        downloadCSV(rows, studentExportHeaders, filename);
      } else {
        await downloadXLSX(rows, studentExportHeaders, filename);
      }
    } finally {
      setExportingClassId(null);
    }
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);

    if (!nextOpen) {
      setEditingClass(null);
      setFormError("");
      if (searchParams?.get("create") === "1") {
        router.replace(pathname, { scroll: false });
      }
    }
  }

  function normalizeClasses(rawClasses: Class[] | null) {
    return (rawClasses ?? []).map((item) => ({
      ...item,
      capacity:
        typeof (item as { capacity?: unknown }).capacity === "number"
          ? (item as { capacity: number }).capacity
          : DEFAULT_CLASS_CAPACITY,
    }));
  }

  const loadClassData = useCallback(async () => {
    const cachedOverview = getAdminPageStorageCache<ClassesOverviewCache>(CLASSES_CACHE_KEY);
    if (cachedOverview) {
      setClasses(cachedOverview.classes);
      setStudentCounts(cachedOverview.studentCounts);
      setTeacherNamesByClass(cachedOverview.teacherNamesByClass);
      setSubjectsByClass(cachedOverview.subjectsByClass);
      setLoading(false);
    }

    const [classesRes, studentsRes, classTeachersRes, classSubjectsRes] = await Promise.all([
      supabase.from("classes").select("*").order("sort_order"),
      supabase.from("students").select("class_id, is_active").eq("is_active", true),
      supabase.from("courses").select("class_id, teacher:teachers(name)").not("teacher_id", "is", null),
      supabase.from("syllabus").select("class_id, subject").order("subject"),
    ]);

    const classRows = normalizeClasses((classesRes.data as Class[] | null) ?? []);
    const counts: Record<string, number> = {};
    ((studentsRes.data as StudentCountRow[] | null) ?? []).forEach((row) => {
      counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
    });
    const teachersMap = new Map<string, Set<string>>();
    ((classTeachersRes.data as ClassTeacherRow[] | null) ?? []).forEach((row) => {
      const teacherName = row.teacher?.name?.trim();
      if (!teacherName) return;
      const existing = teachersMap.get(row.class_id) ?? new Set<string>();
      existing.add(teacherName);
      teachersMap.set(row.class_id, existing);
    });
    const normalizedTeachersMap: Record<string, string[]> = {};
    teachersMap.forEach((names, classId) => {
      normalizedTeachersMap[classId] = [...names].sort((a, b) => a.localeCompare(b));
    });
    const nextSubjectsByClass: Record<string, string[]> = {};
    ((classSubjectsRes.data as ClassSubjectRow[] | null) ?? []).forEach((row) => {
      const subject = normalizeSubject(row.subject);
      if (!subject) return;
      const existing = nextSubjectsByClass[row.class_id] ?? [];
      if (!existing.includes(subject)) {
        existing.push(subject);
      }
      nextSubjectsByClass[row.class_id] = existing;
    });

    setClasses(classRows);
    setStudentCounts(counts);
    setTeacherNamesByClass(normalizedTeachersMap);
    setSubjectsByClass(nextSubjectsByClass);
    setAdminPageCache<ClassesOverviewCache>(CLASSES_CACHE_KEY, {
      classes: classRows,
      studentCounts: counts,
      teacherNamesByClass: normalizedTeachersMap,
      subjectsByClass: nextSubjectsByClass,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (role === "teacher") {
      router.push("/admin/attendance");
      return;
    }

    if (role === "student") {
      router.push("/dashboard");
      return;
    }

    if (role !== "admin" && role !== "super_admin") return;
    void loadClassData();
  }, [role, router, loadClassData, authLoading]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    if (searchParams?.get("create") === "1" && !dialogOpen) {
      setEditingClass(null);
      setFormName("");
      setFormBoard("GSEB");
      setFormLevel("1");
      setFormCapacity(String(DEFAULT_CLASS_CAPACITY));
      setFormSubjectInput("");
      setFormSubjects([]);
      setDialogOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [role, searchParams, dialogOpen, classes.length, router, pathname]);

  function refreshClasses() {
    void loadClassData();
  }

  function openCreate() {
    setEditingClass(null);
    setFormName("");
    setFormBoard("GSEB");
    setFormLevel("1");
    setFormCapacity(String(DEFAULT_CLASS_CAPACITY));
    setFormSubjectInput("");
    setFormSubjects([]);
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(item: Class) {
    setEditingClass(item);
    setFormName(item.name);
    setFormBoard(item.board);
    setFormLevel(item.level);
    setFormCapacity(String(item.capacity ?? DEFAULT_CLASS_CAPACITY));
    setFormSubjectInput("");
    setFormSubjects(subjectsByClass[item.id] ?? []);
    setFormError("");
    setDialogOpen(true);
  }

  async function syncClassSubjects(classId: string, nextSubjects: string[]) {
    if (!user?.id) {
      throw new Error("User context missing. Please sign in again.");
    }

    const normalizedSubjects = Array.from(new Set(nextSubjects.map(normalizeSubject).filter(Boolean)));
    const existingSubjects = subjectsByClass[classId] ?? [];
    const nextSet = new Set(normalizedSubjects);
    const removedSubjects = existingSubjects.filter((subject) => !nextSet.has(subject));

    if (removedSubjects.length > 0) {
      const { error: deleteError } = await supabase
        .from("syllabus")
        .delete()
        .eq("class_id", classId)
        .in("subject", removedSubjects);
      if (deleteError) throw deleteError;
    }

    if (normalizedSubjects.length > 0) {
      const { error: upsertError } = await supabase.from("syllabus").upsert(
        normalizedSubjects.map((subject) => ({
          class_id: classId,
          subject,
          content: {},
          updated_by: user.id,
        })),
        { onConflict: "class_id,subject" },
      );
      if (upsertError) throw upsertError;
    }
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    setFormError("");
    const parsedCapacity = Number.parseInt(formCapacity || String(DEFAULT_CLASS_CAPACITY), 10);
    const normalizedCapacity =
      Number.isFinite(parsedCapacity) && parsedCapacity > 0
        ? parsedCapacity
        : DEFAULT_CLASS_CAPACITY;
    const payload = {
      name: formName.trim(),
      board: formBoard,
      level: formLevel,
      capacity: normalizedCapacity,
      sort_order: editingClass ? editingClass.sort_order : classes.length,
    };
    const payloadWithoutCapacity = {
      name: formName.trim(),
      board: formBoard,
      level: formLevel,
      sort_order: editingClass ? editingClass.sort_order : classes.length,
    };

    try {
      if (editingClass) {
        const { error } = await supabase
          .from("classes")
          .update(payload)
          .eq("id", editingClass.id);
        if (error) {
          if (error.message.includes("capacity")) {
            const { error: retryError } = await supabase
              .from("classes")
              .update(payloadWithoutCapacity)
              .eq("id", editingClass.id);
            if (retryError) throw retryError;
            throw new Error(
              "Capacity column is missing in database. Run latest migration, then capacity updates will work.",
            );
          }
          throw error;
        }
        await syncClassSubjects(editingClass.id, formSubjects);
      } else {
        const { data: createdClass, error } = await supabase
          .from("classes")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          if (error.message.includes("capacity")) {
            const { data: fallbackClass, error: retryError } = await supabase
              .from("classes")
              .insert(payloadWithoutCapacity)
              .select("id")
              .single();
            if (retryError) throw retryError;
            const insertedClass = Array.isArray(fallbackClass)
              ? fallbackClass[0]
              : (fallbackClass as { id?: string } | null);
            if (insertedClass?.id) {
              await syncClassSubjects(insertedClass.id, formSubjects);
            }
            throw new Error(
              "Class created, but capacity column is missing. Run latest migration to enable capacity editing.",
            );
          }
          throw error;
        }
        if (createdClass?.id) {
          await syncClassSubjects(createdClass.id, formSubjects);
        }
      }

      setDialogOpen(false);
      refreshClasses();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Failed to save class.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSeedDefaults() {
    setSeedingDefaults(true);
    setFormError("");

    try {
      let sortOrderOffset = classes.length;
      for (const board of BOARDS) {
        for (const level of DEFAULT_CLASS_LEVEL_SEEDS) {
          const className = `Class ${level}`;
          const existingClass = classes.find(
            (item) => item.board === board && item.level === level && item.name === className,
          );

          if (existingClass) {
            continue;
          }

          const { error: insertError } = await supabase.from("classes").insert({
            name: className,
            board,
            level,
            capacity: DEFAULT_SEEDED_CAPACITY,
            sort_order: sortOrderOffset,
          });
          if (insertError) throw insertError;
          sortOrderOffset += 1;
        }
      }

      await loadClassData();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Failed to seed default classes.";
      setFormError(message);
    } finally {
      setSeedingDefaults(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this class?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (!error) {
      refreshClasses();
    }
  }

  function reorderByIds(list: Class[], fromId: string, toId: string): Class[] {
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;

    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  async function saveClassOrder(nextPrimary: Class[], nextSenior: Class[]) {
    const nextClasses = [...nextPrimary, ...nextSenior].map((item, index) => ({
      ...item,
      sort_order: index,
    }));
    setClasses(nextClasses);
    setReordering(true);
    try {
      const updates = nextClasses.map((item) =>
        supabase.from("classes").update({ sort_order: item.sort_order }).eq("id", item.id),
      );
      const results = await Promise.all(updates);
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;
    } catch {
      await loadClassData();
    } finally {
      setReordering(false);
    }
  }

  async function handleDrop(targetId: string, section: "primary" | "senior") {
    if (!draggingClassId) return;
    if (draggingClassId === targetId) {
      setDraggingClassId(null);
      return;
    }

    const primaryClasses = classes.filter((item) => PRIMARY_LEVELS.has(item.level));
    const seniorClasses = classes.filter((item) => !PRIMARY_LEVELS.has(item.level));
    const isDraggingPrimary = primaryClasses.some((item) => item.id === draggingClassId);
    const expectedPrimary = section === "primary";
    if (isDraggingPrimary !== expectedPrimary) {
      setDraggingClassId(null);
      return;
    }

    if (section === "primary") {
      await saveClassOrder(reorderByIds(primaryClasses, draggingClassId, targetId), seniorClasses);
    } else {
      await saveClassOrder(primaryClasses, reorderByIds(seniorClasses, draggingClassId, targetId));
    }
    setDraggingClassId(null);
  }

  const filteredClasses = classes.filter((item) => {
    if (divisionFilter === "primary" && !PRIMARY_LEVELS.has(item.level)) return false;
    if (divisionFilter === "senior" && PRIMARY_LEVELS.has(item.level)) return false;
    if (boardFilter !== "all" && item.board !== boardFilter) return false;
    if (selectedClassId !== "all" && item.id !== selectedClassId) return false;
    return true;
  });
  const classFilterOptions = classes.filter((item) => {
    if (divisionFilter === "primary" && !PRIMARY_LEVELS.has(item.level)) return false;
    if (divisionFilter === "senior" && PRIMARY_LEVELS.has(item.level)) return false;
    if (boardFilter !== "all" && item.board !== boardFilter) return false;
    return true;
  });
  const selectedClassOption = classFilterOptions.find((item) => item.id === selectedClassId) ?? null;
  const visiblePrimaryClasses = filteredClasses.filter((item) => PRIMARY_LEVELS.has(item.level));
  const visibleSeniorClasses = filteredClasses.filter((item) => !PRIMARY_LEVELS.has(item.level));
  const showPrimarySection = divisionFilter !== "senior";
  const showSeniorSection = divisionFilter !== "primary";
  const totalActiveStudents = Object.values(studentCounts).reduce((acc, count) => acc + count, 0);
  const totalCapacity = classes.reduce((acc, item) => acc + (item.capacity ?? DEFAULT_CLASS_CAPACITY), 0);
  const utilizationPercent =
    totalCapacity > 0 ? Math.round((totalActiveStudents / totalCapacity) * 100) : 0;

  useEffect(() => {
    if (selectedClassId === "all") return;
    if (!classFilterOptions.some((item) => item.id === selectedClassId)) {
      setSelectedClassId("all");
    }
  }, [classFilterOptions, selectedClassId]);

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Institutional Structures"
        title="Academic Structures"
        description="Manage classrooms, student capacities, and curriculum timelines across the academy's core disciplines."
        action={
          <>
            <button
              type="button"
              className={stitchSecondaryButtonClass}
              onClick={() => void handleSeedDefaults()}
              disabled={seedingDefaults}
            >
              {seedingDefaults ? "Seeding..." : "Load STC Defaults"}
            </button>
            <button type="button" className={stitchButtonClass} onClick={openCreate}>
              Add Class
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      ) : classes.length === 0 ? (
        <div className="mt-10">
          <StitchEmptyState
            icon={Loader2}
            title="No Academic Structures"
            description="Create the first class level to begin mapping the STC teaching architecture."
          />
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className={stitchPanelClass}>
            <p className="stitch-kicker">Total Enrollment</p>
            <p className="mt-5 font-heading text-6xl text-foreground">{totalActiveStudents}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Active students across all classes
            </p>
          </div>
          <div className={stitchPanelClass}>
            <p className="stitch-kicker">Capacity Utilization</p>
            <p className="mt-5 font-heading text-6xl text-foreground">{utilizationPercent}%</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {totalActiveStudents}/{totalCapacity} filled seats
            </p>
          </div>
        </div>

          <div className={cn(stitchPanelClass, "mt-8 p-4 md:p-5")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="min-w-[220px]">
                <label className="text-sm font-medium">Division</label>
                <Select
                  value={divisionFilter}
                  onValueChange={(value) => setDivisionFilter((value ?? "all") as DivisionFilter)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All divisions</SelectItem>
                    <SelectItem value="primary">Class 1-9</SelectItem>
                    <SelectItem value="senior">SSC / HSC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[220px]">
                <label className="text-sm font-medium">Board</label>
                <Select value={boardFilter} onValueChange={(value) => setBoardFilter((value ?? "all") as BoardFilter)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All boards</SelectItem>
                    {BOARDS.map((board) => (
                      <SelectItem key={board} value={board}>
                        {board}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[260px]">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClassId} onValueChange={(value) => setSelectedClassId(value ?? "all")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue>
                      {selectedClassOption ? `${selectedClassOption.name} (${selectedClassOption.board})` : "All classes"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {classFilterOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.board})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                className={cn(stitchSecondaryButtonClass, "lg:ml-auto")}
                onClick={() => {
                  setDivisionFilter("all");
                  setBoardFilter("all");
                  setSelectedClassId("all");
                }}
                disabled={divisionFilter === "all" && boardFilter === "all" && selectedClassId === "all"}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {showPrimarySection ? (
          <section className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-4xl text-foreground">Class 1-9 Division</h2>
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {visiblePrimaryClasses.length} Active Classes
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-6">
              {visiblePrimaryClasses.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    stitchPanelClass,
                    "p-4 md:p-5",
                    reordering ? "opacity-70" : "",
                    draggingClassId === item.id ? "ring-2 ring-primary/40" : "",
                  )}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void handleDrop(item.id, "primary")}
                >
                  {(() => {
                    const enrolled = studentCounts[item.id] ?? 0;
                    const capacity = item.capacity ?? DEFAULT_CLASS_CAPACITY;
                    const usage = Math.min(100, Math.round((enrolled / Math.max(1, capacity)) * 100));
                    const assignedTeachers = teacherNamesByClass[item.id] ?? [];
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="stitch-pill px-2.5 py-1 text-[9px]">{item.board}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              draggable
                              onDragStart={() => setDraggingClassId(item.id)}
                              onDragEnd={() => setDraggingClassId(null)}
                              className="text-muted-foreground"
                              title="Drag to reorder"
                              disabled={reordering}
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openEdit(item)} className="text-muted-foreground">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <h3 className="mt-5 text-xl text-foreground md:text-2xl">{item.name}</h3>
                        <p className="mt-3 text-xs leading-6 text-muted-foreground">
                          {assignedTeachers.length > 0
                            ? `Teacher: ${assignedTeachers.join(", ")}`
                            : "Teacher: Unassigned"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {enrolled} active students
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Subjects: {(subjectsByClass[item.id] ?? []).join(", ") || "Not added"}
                        </p>
                        <div className="mt-5 h-1 rounded-full bg-border">
                          <div className="h-1 rounded-full bg-primary" style={{ width: `${usage}%` }} />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          <span>Capacity</span>
                          <span>{enrolled}/{capacity}</span>
                        </div>
                        <div className="mt-3 flex gap-1.5">
                          <button
                            type="button"
                            className="rounded-md bg-muted/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                            onClick={() => void exportClassStudents(item.id, item.name, "csv")}
                            disabled={exportingClassId === item.id}
                            title="Download students CSV"
                          >
                            <Download className="mr-1 inline h-3 w-3" />CSV
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-muted/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                            onClick={() => void exportClassStudents(item.id, item.name, "xlsx")}
                            disabled={exportingClassId === item.id}
                            title="Download students Excel"
                          >
                            <Download className="mr-1 inline h-3 w-3" />Excel
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </article>
              ))}
              {selectedClassId === "all" ? (
              <button type="button" className={cn(stitchPanelClass, "border-dashed")} onClick={openCreate}>
                <div className="flex min-h-[170px] items-center justify-center px-4 text-sm text-muted-foreground">
                  Create Primary Section
                </div>
              </button>
              ) : null}
            </div>
          </section>
          ) : null}

          {showSeniorSection ? (
          <section className="mt-10">
            <h2 className="text-4xl text-foreground">Secondary & Higher Secondary</h2>
            <div className={cn(stitchPanelClass, "mt-5 overflow-x-auto")}>
              <table className="w-full min-w-[840px] text-left">
                <thead className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  <tr>
                    <th className="pb-4 font-medium">Classification</th>
                    <th className="pb-4 font-medium">Class Name</th>
                    <th className="pb-4 font-medium">Assigned Teacher</th>
                    <th className="pb-4 font-medium">Active Students</th>
                    <th className="pb-4 font-medium">Utilization</th>
                    <th className="pb-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleSeniorClasses.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(draggingClassId === item.id ? "ring-2 ring-primary/40" : "", reordering ? "opacity-70" : "")}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => void handleDrop(item.id, "senior")}
                    >
                      <td className="py-4">
                        <span className="stitch-pill px-3 py-1 text-[10px]">{item.level}</span>
                      </td>
                      <td className="py-4">
                        <p className="text-base text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.board} Division</p>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {(teacherNamesByClass[item.id] ?? []).length > 0
                          ? (teacherNamesByClass[item.id] ?? []).join(", ")
                          : "Unassigned"}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(subjectsByClass[item.id] ?? []).join(", ") || "No subjects"}
                        </p>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {studentCounts[item.id] ?? 0}/{item.capacity ?? DEFAULT_CLASS_CAPACITY}
                      </td>
                      <td className="py-4">
                        {(() => {
                          const enrolled = studentCounts[item.id] ?? 0;
                          const capacity = item.capacity ?? DEFAULT_CLASS_CAPACITY;
                          const usage = Math.min(100, Math.round((enrolled / Math.max(1, capacity)) * 100));
                          return (
                            <div className="h-1 rounded-full bg-border">
                              <div className="h-1 rounded-full bg-[#9db7c5]" style={{ width: `${usage}%` }} />
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            draggable
                            onDragStart={() => setDraggingClassId(item.id)}
                            onDragEnd={() => setDraggingClassId(null)}
                            className="text-muted-foreground"
                            title="Drag to reorder"
                            disabled={reordering}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => openEdit(item)} className="text-muted-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => void handleDelete(item.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void exportClassStudents(item.id, item.name, "csv")}
                            className="text-muted-foreground"
                            title="Download students CSV"
                            disabled={exportingClassId === item.id}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          ) : null}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Class Name</label>
              <Input
                placeholder="e.g. Class 5 - GSEB"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Board</label>
                <Select value={formBoard} onValueChange={(value) => setFormBoard((value ?? "GSEB") as BoardType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOARDS.map((board) => (
                      <SelectItem key={board} value={board}>
                        {board}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Level</label>
                <Select value={formLevel} onValueChange={(value) => setFormLevel((value ?? "1") as ClassLevel)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {["SSC", "HSC"].includes(level) ? level : `Class ${level}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Capacity</label>
              <Input
                type="number"
                min={1}
                value={formCapacity}
                onChange={(event) => setFormCapacity(event.target.value)}
                className="mt-1 w-24"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium">Subjects</label>
                <span className="text-xs text-muted-foreground">Manual subject list</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Add subject"
                  value={formSubjectInput}
                  onChange={(event) => setFormSubjectInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addFormSubject(formSubjectInput);
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => addFormSubject(formSubjectInput)}>
                  Add
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {formSubjects.length > 0 ? (
                  formSubjects.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      className="rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                      onClick={() => removeFormSubject(subject)}
                      title="Remove subject"
                    >
                      {subject} ×
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No subjects added yet.</p>
                )}
              </div>
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim()} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingClass ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminClassesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <AdminClassesPageInner />
    </Suspense>
  );
}
