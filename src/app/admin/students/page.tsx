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
  is_active: boolean;
  student_type: "tuition" | "online";
  profile: { full_name: string; phone: string } | null;
  class: { name: string; board: string } | null;
}

function AdminStudentsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useAuth();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("students")
      .select(
        "id, profile_id, class_id, enrollment_date, is_active, student_type, profile:profiles(full_name, phone), class:classes(name, board)"
      )
      .order("enrollment_date", { ascending: false });
    setStudents((data as StudentRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role === "teacher") {
      router.push("/admin/attendance");
      return;
    }

    if (role === "admin") {
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
    const haystack = `${student.profile?.full_name ?? ""} ${student.class?.name ?? ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const activeCount = students.filter((student) => student.is_active).length;
  const tuitionCount = students.filter((student) => student.student_type === "tuition").length;
  const onlineCount = students.filter((student) => student.student_type === "online").length;

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <StitchSectionHeader
          eyebrow="Administration Hub"
          title="Student Management"
          description="Oversee your cohort's academic progress, administrative standing, and board affiliations through the central atelier interface."
        />
        <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className={stitchButtonClass}
              onClick={() => {
                setEditingStudent(null);
                setDialogOpen(true);
              }}
            >
              Add Scholar
            </button>
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
            <button type="button" className={stitchSecondaryButtonClass}>
              Refine
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className={stitchPanelSoftClass}>
          <p className="stitch-kicker">Total Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{students.length}</p>
          <p className="mt-2 text-xs text-muted-foreground">+12%</p>
        </div>
        <div className={stitchPanelSoftClass}>
          <p className="stitch-kicker">Active Enrollment</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{activeCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">Stable</p>
        </div>
        <div className={stitchPanelSoftClass}>
          <p className="stitch-kicker">Tuition Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{tuitionCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">Offline class access</p>
        </div>
        <div className={stitchPanelSoftClass}>
          <p className="stitch-kicker">Online Students</p>
          <p className="mt-5 font-heading text-5xl text-foreground">{onlineCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">Purchase-based access</p>
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
            description="Create the first scholar profile to begin populating the institutional registry."
          />
        </div>
      ) : (
        <>
          <div className={cn(stitchPanelClass, "mt-8 overflow-x-auto")}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl text-foreground">Institutional Registry</h2>
              <button
                type="button"
                className={stitchButtonClass}
                onClick={() => {
                  setEditingStudent(null);
                  setDialogOpen(true);
                }}
              >
                Add Scholar
              </button>
            </div>
            <table className="w-full min-w-[920px] text-left">
              <thead className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <tr>
                  <th className="pb-4 font-medium">Name & Profile</th>
                  <th className="pb-4 font-medium">Student ID</th>
                  <th className="pb-4 font-medium">Class Level</th>
                  <th className="pb-4 font-medium">Academic Board</th>
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
                        {student.profile?.full_name ?? "Unnamed Scholar"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {student.profile?.phone ?? "No phone"}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className={stitchPanelClass}>
              <h3 className="text-4xl text-foreground">Board Compliance Overview</h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Your current enrollment aligns with 94% institutional policy.
                Review pending status updates to maintain accreditation.
              </p>
              <button type="button" className={cn(stitchButtonClass, "mt-8")}>
                View Compliance Report
              </button>
            </div>
            <div className={stitchPanelClass}>
              <h3 className="text-4xl text-foreground">Mastery Progression</h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Student level distributions are trending toward advanced cohorts.
                Consider expanding atelier capacity for the upcoming semester.
              </p>
              <button type="button" className={cn(stitchSecondaryButtonClass, "mt-8")}>
                Analyze Academic Trends
              </button>
            </div>
          </div>
        </>
      )}

      <StudentFormDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditingStudent(null);
        }}
        onSuccess={fetchStudents}
        editStudent={editingStudent}
      />
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
