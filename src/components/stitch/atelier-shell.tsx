"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookCopy,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Download,
  FolderOpen,
  GraduationCap,
  House,
  LayoutGrid,
  LibraryBig,
  LogOut,
  Menu,
  QrCode,
  ScanLine,
  ShieldQuestion,
  Sparkles,
  Users,
} from "lucide-react";
import { getCachedStudentType, setCachedStudentType } from "@/lib/auth/client-cache";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  { href: "/admin/qr-codes", label: "QR Codes", icon: QrCode },
  { href: "/admin/qr-scan", label: "QR Scanner", icon: ScanLine },
  { href: "/admin/syllabus", label: "Syllabus", icon: BookCopy },
  { href: "/admin/materials", label: "Assets", icon: FolderOpen },
];

const teacherLinks = [
  { href: "/", label: "Home", icon: House },
  { href: "/admin/attendance", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/admin/qr-scan", label: "QR Scanner", icon: ScanLine },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [studentType, setStudentType] = useState<"tuition" | "online" | null>(null);
  const [studentTypeLoaded, setStudentTypeLoaded] = useState(area !== "student");
  const isOnlineStudent = area === "student" && studentType === "online";
  const isTuitionStudent = area === "student" && studentType === "tuition";

  // ── QR Code state (tuition students only) ──
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const userId = user?.id ?? null;
  const fullNameForQr =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Scholar";

  useEffect(() => {
    let cancelled = false;

    async function loadStudentType() {
      if (area !== "student" || profile?.role !== "student" || !user?.id) {
        setStudentType(null);
        setStudentTypeLoaded(true);
        return;
      }

      setStudentTypeLoaded(false);

      const cachedStudentType = getCachedStudentType(user.id);
      if (cachedStudentType) {
        setStudentType(cachedStudentType);
        setStudentTypeLoaded(true);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("students")
        .select("student_type")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        const resolvedStudentType =
          ((data as { student_type?: "tuition" | "online" } | null)?.student_type ?? null);
        if (resolvedStudentType) {
          setCachedStudentType(user.id, resolvedStudentType);
        }
        setStudentType(resolvedStudentType);
        setStudentTypeLoaded(true);
      }
    }

    void loadStudentType();

    return () => {
      cancelled = true;
    };
  }, [area, profile?.role, user]);

  // ── Fetch QR token for tuition students ──
  useEffect(() => {
    if (!isTuitionStudent || !userId) return;
    let cancelled = false;

    async function fetchQrToken() {
      const supabase = createClient();
      // First get student id from profile_id
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle();

      if (!student || cancelled) return;

      const { data: tokenRow } = await supabase
        .from("qr_tokens")
        .select("public_token")
        .eq("student_id", (student as { id: string }).id)
        .maybeSingle();

      if (!cancelled) {
        setQrToken((tokenRow as { public_token: string } | null)?.public_token ?? null);
      }
    }

    void fetchQrToken();
    return () => { cancelled = true; };
  }, [isTuitionStudent, userId]);

  // ── Render QR code on canvas when dialog opens and token is available ──
  useEffect(() => {
    if (!qrDialogOpen || !qrToken) return;
    // Small delay to let the dialog DOM render the canvas
    const timer = setTimeout(async () => {
      if (!qrCanvasRef.current) return;
      const QRCode = (await import("qrcode")).default;
      await QRCode.toCanvas(qrCanvasRef.current, qrToken, {
        width: 220,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [qrDialogOpen, qrToken]);

  const handleDownloadQr = useCallback(() => {
    if (!qrCanvasRef.current) return;
    const link = document.createElement("a");
    link.download = `my_qr_${fullNameForQr.replace(/\s+/g, "_")}.png`;
    link.href = qrCanvasRef.current.toDataURL("image/png");
    link.click();
  }, [fullNameForQr]);

  const links =
    area === "admin"
      ? isTeacherArea
        ? teacherLinks
        : adminLinks
      : !studentTypeLoaded || isOnlineStudent
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
                    : { label: "+ New Record", href: "/admin/students?create=1" }
      : pathname.startsWith("/dashboard/attendance")
        ? { label: "View Dashboard", href: "/dashboard" }
      : pathname.startsWith("/dashboard/materials")
        ? { label: "View Curriculum", href: "/dashboard/syllabus" }
      : pathname.startsWith("/dashboard/syllabus")
        ? { label: "Open Library", href: "/dashboard/materials" }
      : pathname.startsWith("/dashboard/settings")
        ? { label: "Class Details", href: "/dashboard/class" }
      : isOnlineStudent
        ? { label: "Open My Courses", href: "/dashboard/class" }
        : { label: "Open Class Details", href: "/dashboard/class" };
  const supportHref =
    area === "admin"
      ? "mailto:stcinstindia@gmail.com?subject=STC%20Admin%20Support"
      : "mailto:stcinstindia@gmail.com?subject=STC%20Student%20Support";

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-5 py-5 lg:block">
        <Link href="/" className="font-heading text-3xl italic text-foreground">
          STC Academy
        </Link>
        <span className="rounded-full border border-black/6 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground lg:hidden">
          {area}
        </span>
      </div>

      <div className="px-4 pb-5">
        <div className="rounded-[20px] border border-black/6 bg-white p-4 shadow-[0_18px_40px_-28px_rgba(26,28,29,0.18)]">
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
              onClick={() => setMobileMenuOpen(false)}
              className="stitch-sidebar-link"
              data-active={isActive}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* QR Code button for tuition students */}
        {isTuitionStudent && (
          <button
            type="button"
            onClick={() => { setMobileMenuOpen(false); setQrDialogOpen(true); }}
            className="stitch-sidebar-link w-full text-left"
          >
            <QrCode className="h-4 w-4" />
            <span className="truncate">My QR Code</span>
          </button>
        )}
      </nav>

      <div className="border-t border-black/5 px-3 py-5">
        <Link
          href={contextualAction.href}
          onClick={() => setMobileMenuOpen(false)}
          className={`mb-5 flex w-full items-center justify-center rounded-2xl border px-4 py-3 text-sm font-medium transition ${
            area === "admin"
              ? "border-primary/10 bg-primary text-white hover:brightness-105"
              : "border-black/6 bg-white text-foreground hover:bg-muted"
          }`}
        >
          {contextualAction.label}
        </Link>
        <div className="grid gap-1">
          <a
            href={supportHref}
            className="stitch-sidebar-link w-full text-left"
          >
            <ShieldQuestion className="h-4 w-4" />
            <span>Support</span>
          </a>
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
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-black/6 bg-surface-container-low/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="font-heading text-2xl italic text-foreground">
          STC Academy
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-10 w-10 rounded-xl")}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open workspace menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm bg-surface-container-low p-0">
            <div className="h-full overflow-y-auto">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden border-r border-black/5 bg-surface-container-low lg:block lg:min-h-screen">
        {sidebar}
      </aside>

      <div className="min-w-0 bg-muted">{children}</div>

      {/* ── QR Code Dialog ── */}
      {isTuitionStudent && (
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>My QR Code</DialogTitle>
              <DialogDescription>
                Show this QR code to your teacher for attendance check-in &amp; check-out.
              </DialogDescription>
            </DialogHeader>

            {qrToken ? (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <canvas ref={qrCanvasRef} className="rounded-lg" />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/6 bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  Save QR
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/6 bg-muted/50 p-8 text-center">
                <QrCode className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Your QR code has not been generated yet. Please contact your teacher or admin.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
