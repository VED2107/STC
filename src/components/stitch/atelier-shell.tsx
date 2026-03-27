"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookCopy,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  House,
  LayoutGrid,
  LibraryBig,
  LogOut,
  Menu,
  ShieldQuestion,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ShellArea = "admin" | "student";

interface AtelierShellProps {
  area: ShellArea;
  children: React.ReactNode;
}

const adminLinks = [
  { href: "/", label: "Home", icon: House },
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/students", label: "Institutional Registry", icon: Users },
  { href: "/admin/teachers", label: "Faculty", icon: GraduationCap },
  { href: "/admin/classes", label: "Academic Structures", icon: LibraryBig },
  { href: "/admin/courses", label: "Curriculum", icon: BookOpen },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/admin/syllabus", label: "Syllabus", icon: BookCopy },
  { href: "/admin/materials", label: "Assets", icon: FolderOpen },
];

const teacherLinks = [
  { href: "/", label: "Home", icon: House },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/admin/syllabus", label: "Syllabus", icon: BookCopy },
  { href: "/admin/materials", label: "Assets", icon: FolderOpen },
];

const studentLinks = [
  { href: "/", label: "Home", icon: House },
  { href: "/dashboard", label: "Dashboard", icon: Sparkles },
  { href: "/dashboard/class", label: "Class Details", icon: GraduationCap },
  { href: "/dashboard/syllabus", label: "Curriculum", icon: BookOpen },
  { href: "/dashboard/materials", label: "Library", icon: FolderOpen },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/dashboard/settings", label: "Settings", icon: BookCopy },
];

const onlineStudentLinks = [
  { href: "/", label: "Home", icon: House },
  { href: "/dashboard", label: "Dashboard", icon: Sparkles },
  { href: "/dashboard/class", label: "Class Details", icon: GraduationCap },
  { href: "/dashboard/syllabus", label: "Curriculum", icon: BookOpen },
  { href: "/dashboard/materials", label: "Library", icon: FolderOpen },
  { href: "/dashboard/settings", label: "Settings", icon: BookCopy },
];

export function AtelierShell({ area, children }: AtelierShellProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const isTeacherArea = area === "admin" && profile?.role === "teacher";
  const [studentType, setStudentType] = useState<"tuition" | "online" | null>(null);
  const isOnlineStudent = area === "student" && studentType === "online";

  useEffect(() => {
    let cancelled = false;

    async function loadStudentType() {
      if (area !== "student" || profile?.role !== "student" || !user?.id) {
        setStudentType(null);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("students")
        .select("student_type")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setStudentType(
          ((data as { student_type?: "tuition" | "online" } | null)?.student_type ?? null),
        );
      }
    }

    void loadStudentType();

    return () => {
      cancelled = true;
    };
  }, [area, profile?.role, user?.id]);

  const links =
    area === "admin"
      ? isTeacherArea
        ? teacherLinks
        : adminLinks
      : isOnlineStudent
        ? onlineStudentLinks
        : studentLinks;
  const rootHref = area === "admin" ? (isTeacherArea ? "/admin/attendance" : "/admin") : "/dashboard";
  const fullName: string =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    (area === "admin" ? "Academic Dean" : "Scholar");
  const initials = fullName
    .split(" ")
    .map((part: string) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const contextualAction =
    area === "admin"
      ? isTeacherArea
        ? pathname.startsWith("/admin/syllabus")
          ? { label: "Open Attendance", href: "/admin/attendance" }
          : pathname.startsWith("/admin/materials")
            ? { label: "Open Syllabus", href: "/admin/syllabus" }
            : { label: "Open Materials", href: "/admin/materials" }
        : pathname.startsWith("/admin/teachers")
          ? { label: "+ Create Teacher", href: "/admin/teachers?create=1" }
          : pathname.startsWith("/admin/students")
            ? { label: "+ Add Student", href: "/admin/students?create=1" }
            : pathname.startsWith("/admin/courses")
              ? { label: "+ Add Course", href: "/admin/courses?create=1" }
              : pathname.startsWith("/admin/classes")
                ? { label: "+ Add Class", href: "/admin/classes?create=1" }
                : pathname.startsWith("/admin/materials")
                  ? { label: "+ Add Material", href: "/admin/materials?create=1" }
                  : pathname.startsWith("/admin/syllabus")
                    ? { label: "+ Add Syllabus", href: "/admin/syllabus?create=1" }
                    : { label: "+ New Record", href: "/admin" }
      : pathname.startsWith("/dashboard/attendance")
        ? { label: "View Dashboard", href: "/dashboard" }
        : pathname.startsWith("/dashboard/materials")
          ? { label: "View Curriculum", href: "/dashboard/syllabus" }
          : pathname.startsWith("/dashboard/syllabus")
            ? { label: "Open Library", href: "/dashboard/materials" }
            : pathname.startsWith("/dashboard/settings")
              ? { label: "Class Details", href: "/dashboard/class" }
              : isOnlineStudent
                ? { label: "Open Library", href: "/dashboard/materials" }
                : { label: "Profile Settings", href: "/dashboard/settings" };

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-5 py-5 lg:block">
        <Link href={area === "admin" ? "/admin" : "/dashboard"} className="font-heading text-3xl italic text-foreground">
          STC Academy
        </Link>
        <span className="rounded-full border border-black/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground lg:hidden">
          {area}
        </span>
      </div>

      <div className="px-4 pb-5">
        <div className="rounded-[20px] border border-black/[0.06] bg-white p-4 shadow-[0_18px_40px_-28px_rgba(26,28,29,0.18)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{fullName}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {area === "admin"
                  ? isTeacherArea
                    ? "Teacher Workspace"
                    : "Command Access"
                  : "Student Workspace"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav className="grid gap-1 px-3 pb-5">
        {links.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === pathname ||
            (item.href !== rootHref && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="stitch-sidebar-link"
              data-active={isActive}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-black/[0.05] px-3 py-5">
        <Link
          href={contextualAction.href}
          className={`mb-5 flex w-full items-center justify-center rounded-2xl border px-4 py-3 text-sm font-medium transition ${
            area === "admin"
              ? "border-primary/10 bg-primary text-white hover:brightness-105"
              : "border-black/[0.06] bg-white text-foreground hover:bg-muted"
          }`}
        >
          {contextualAction.label}
        </Link>
        <div className="grid gap-1">
          <Link
            href={area === "admin" ? "/admin" : "/dashboard/settings"}
            className="stitch-sidebar-link w-full text-left"
          >
            <ShieldQuestion className="h-4 w-4" />
            <span>Support</span>
          </Link>
          <button
            type="button"
            className="stitch-sidebar-link w-full text-left"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="stitch-app-surface min-h-screen bg-muted text-foreground lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-black/[0.06] bg-[#f3f3f5]/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href={area === "admin" ? "/admin" : "/dashboard"} className="font-heading text-2xl italic text-foreground">
          STC Academy
        </Link>
        <Sheet>
          <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-10 w-10 rounded-xl")}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open workspace menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm bg-[#f3f3f5] p-0">
            <div className="h-full overflow-y-auto">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden border-r border-black/[0.05] bg-[#f3f3f5] lg:block lg:min-h-screen">
        {sidebar}
      </aside>

      <div className="min-w-0 bg-muted">{children}</div>
    </div>
  );
}
