import Link from "next/link";
import { ClipboardList, FolderOpen, ScanLine, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StepMotif } from "@/components/stitch/step-horizon";
import { stitchButtonClass, stitchOutlineButtonClass } from "@/components/stitch/primitives";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

interface TeacherClass {
  id: string;
  name: string;
  board: string;
}

interface TodaySession {
  id: string;
  class_id: string;
  subject: string;
  is_active: boolean;
}

/** A teacher's day: their classes, whether attendance is open for each, and the next action. */
export async function TeacherHome({ userId, fullName }: { userId: string; fullName: string | null }) {
  const supabase = await createClient();

  const { data: accessRows, error: accessError } = await supabase
    .from("teacher_class_access")
    .select("class_id")
    .eq("teacher_profile_id", userId);

  const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map((row) => row.class_id);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  const [classesRes, studentsRes, sessionsRes] = classIds.length
    ? await Promise.all([
        supabase.from("classes").select("id, name, board").in("id", classIds).order("sort_order"),
        supabase.from("students").select("id, class_id").in("class_id", classIds).eq("is_active", true),
        supabase.from("attendance_sessions").select("id, class_id, subject, is_active").in("class_id", classIds).eq("session_date", today),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const classes = (classesRes.data as TeacherClass[] | null) ?? [];
  const students = (studentsRes.data as { id: string; class_id: string }[] | null) ?? [];
  const sessions = (sessionsRes.data as TodaySession[] | null) ?? [];
  const firstName = (fullName ?? "").split(" ")[0];

  return (
    <div className="px-4 py-6 md:px-8">
      <p className="text-sm font-medium text-secondary">{todayLabel}</p>
      <h1 className="mt-1 text-3xl text-primary md:text-4xl">{firstName ? `Hello, ${firstName}` : "Your classes"}</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/admin/qr-scan" className={stitchButtonClass}>
          <ScanLine aria-hidden="true" className="size-4" />
          Scan attendance
        </Link>
        <Link href="/admin/attendance" className={stitchOutlineButtonClass}>
          <ClipboardList aria-hidden="true" className="size-4" />
          Mark by hand
        </Link>
        <Link href="/admin/materials" className={stitchOutlineButtonClass}>
          <FolderOpen aria-hidden="true" className="size-4" />
          Add material
        </Link>
      </div>

      {accessError ? (
        <p role="alert" className="mt-6 rounded-xl bg-danger-soft p-4 text-sm text-destructive">
          Your classes could not be loaded. Refresh the page to try again.
        </p>
      ) : classes.length === 0 ? (
        <div className="stitch-panel mt-8 flex flex-col items-center px-6 py-14 text-center">
          <StepMotif className="h-12 w-20" />
          <h2 className="mt-4 text-2xl text-primary">No classes assigned yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Ask your administrator to assign your classes. They will appear here.</p>
        </div>
      ) : (
        <section aria-labelledby="my-classes" className="mt-8">
          <h2 id="my-classes" className="text-xl text-primary">My classes today</h2>
          <ul className="rise-in mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((item) => {
              const count = students.filter((student) => student.class_id === item.id).length;
              const classSessions = sessions.filter((session) => session.class_id === item.id);
              const open = classSessions.filter((session) => session.is_active);

              return (
                <li key={item.id} className="stitch-panel stitch-hover-lift flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-xl text-primary">{item.name}</h3>
                      <p className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                        {item.board}
                        <span className="inline-flex items-center gap-1">
                          <Users aria-hidden="true" className="size-3.5" />
                          <span className="tnum">{count}</span> {count === 1 ? "student" : "students"}
                        </span>
                      </p>
                    </div>
                    <Badge variant={open.length > 0 ? "success" : classSessions.length > 0 ? "secondary" : "warning"}>
                      {open.length > 0 ? "Session open" : classSessions.length > 0 ? "Session closed" : "Not started"}
                    </Badge>
                  </div>
                  {classSessions.length > 0 ? (
                    <p className="mt-3 truncate text-sm text-muted-foreground">{classSessions.map((session) => session.subject).join(", ")}</p>
                  ) : null}
                  <div className="mt-4 flex gap-2 pt-1">
                    <Link href="/admin/qr-scan" className={cn(stitchOutlineButtonClass, "flex-1")}>Scan</Link>
                    <Link href="/admin/attendance" className={cn(stitchOutlineButtonClass, "flex-1")}>Mark</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
