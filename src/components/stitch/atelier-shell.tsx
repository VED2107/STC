"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  BookCopy,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Download,
  FolderOpen,
  Globe,
  GraduationCap,
  LayoutGrid,
  LibraryBig,
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getCachedStudentType, setCachedStudentType } from "@/lib/auth/client-cache";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CommandPalette, type CommandItem } from "@/components/stitch/command-palette";
import { StcMark, StcWordmark } from "@/components/stitch/primitives";
import { createClient } from "@/lib/supabase/client";
import { setAdminPageCache } from "@/lib/admin-page-cache";
import { cn } from "@/lib/utils";

type ShellArea = "admin" | "student";

interface AtelierShellProps {
  area: ShellArea;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const adminNav: NavGroup[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutGrid }] },
  {
    label: "People",
    items: [
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
    ],
  },
  {
    label: "Attendance",
    items: [
      { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
      { href: "/admin/qr-scan", label: "QR scanner", icon: ScanLine },
      { href: "/admin/qr-codes", label: "QR codes", icon: QrCode },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/admin/classes", label: "Classes", icon: LibraryBig },
      { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
      { href: "/admin/syllabus", label: "Syllabus", icon: BookCopy },
      { href: "/admin/materials", label: "Materials", icon: FolderOpen },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/audit-logs", label: "Audit logs", icon: Shield },
    ],
  },
];

const teacherNav: NavGroup[] = [
  { label: "Today", items: [{ href: "/admin", label: "Dashboard", icon: LayoutGrid }] },
  {
    label: "Attendance",
    items: [
      { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
      { href: "/admin/qr-scan", label: "QR scanner", icon: ScanLine },
    ],
  },
  {
    label: "My classes",
    items: [
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/syllabus", label: "Syllabus", icon: BookCopy },
      { href: "/admin/materials", label: "Materials", icon: FolderOpen },
    ],
  },
];

const tuitionStudentNav: NavGroup[] = [
  {
    label: "My classes",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/dashboard/class", label: "Class details", icon: GraduationCap },
      { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
    ],
  },
  {
    label: "Study",
    items: [
      { href: "/dashboard/syllabus", label: "Syllabus", icon: BookOpen },
      { href: "/dashboard/materials", label: "Materials", icon: FolderOpen },
    ],
  },
  { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }] },
];

const onlineStudentNav: NavGroup[] = [
  {
    label: "My courses",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/dashboard/class", label: "Class details", icon: GraduationCap },
    ],
  },
  {
    label: "Study",
    items: [
      { href: "/dashboard/syllabus", label: "Syllabus", icon: BookOpen },
      { href: "/dashboard/materials", label: "Materials", icon: FolderOpen },
    ],
  },
  { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }] },
];

const adminPrimaryActions: Array<{ prefix: string; label: string; href: string }> = [
  { prefix: "/admin/teachers", label: "Add teacher", href: "/admin/teachers?create=1" },
  { prefix: "/admin/students", label: "Add student", href: "/admin/students?create=1" },
  { prefix: "/admin/courses", label: "Add subject", href: "/admin/subjects?create=1" },
  { prefix: "/admin/subjects", label: "Add subject", href: "/admin/subjects?create=1" },
  { prefix: "/admin/classes", label: "Add class", href: "/admin/classes?create=1" },
  { prefix: "/admin/materials", label: "Add material", href: "/admin/materials?create=1" },
  { prefix: "/admin/syllabus", label: "Add syllabus", href: "/admin/syllabus?create=1" },
];

/* Rail preference lives in this browser only. */
const RAIL_KEY = "stc:rail-collapsed";
const railListeners = new Set<() => void>();

function readRail() {
  try {
    return window.localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRail(collapsed: boolean) {
  try {
    window.localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
  } catch {}
  railListeners.forEach((listener) => listener());
}

function subscribeRail(listener: () => void) {
  railListeners.add(listener);
  return () => railListeners.delete(listener);
}

/** The most specific nav match wins, so /admin never lights up on /admin/students. */
function findActiveHref(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AtelierShell({ area, children }: AtelierShellProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const isTeacherArea = area === "admin" && profile?.role === "teacher";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [studentType, setStudentType] = useState<"tuition" | "online" | null>(null);
  const [studentTypeLoaded, setStudentTypeLoaded] = useState(area !== "student");
  const railCollapsed = useSyncExternalStore(subscribeRail, readRail, () => false);
  const isOnlineStudent = area === "student" && studentType === "online";
  const isTuitionStudent = area === "student" && studentType === "tuition";

  // ── QR code state (tuition students only) ──
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const userId = user?.id ?? null;
  const fullName: string =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    (area === "admin" ? "Administrator" : "Student");

  useEffect(() => {
    if (area !== "admin" || !profile?.role) {
      return;
    }

    const profileRole = profile.role;
    let cancelled = false;

    async function warmAdminCaches() {
      const supabase = createClient();

      if (profileRole === "teacher" && user?.id) {
        const { data: accessRows } = await supabase
          .from("teacher_class_access")
          .select("class_id")
          .eq("teacher_profile_id", user.id);

        if (cancelled) return;

        const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map((row) => row.class_id);
        if (classIds.length === 0) return;

        const [{ data: classes }, { data: courses }, { data: syllabusData }] = await Promise.all([
          supabase.from("classes").select("*").in("id", classIds).order("sort_order"),
          supabase.from("courses").select("id, title, subject, class_id").in("class_id", classIds).order("title"),
          supabase.from("syllabus").select("*, class:classes(*)").in("class_id", classIds).order("subject"),
        ]);

        if (cancelled) return;

        setAdminPageCache(`admin:materials:classes:teacher:${user.id}`, classes ?? []);
        setAdminPageCache(`admin:attendance:base:teacher:${user.id}`, {
          classes: classes ?? [],
          courses: courses ?? [],
        });
        setAdminPageCache(`admin:syllabus:teacher:${user.id}`, {
          classes: classes ?? [],
          syllabi: syllabusData ?? [],
        });
        return;
      }

      if (profileRole !== "admin" && profileRole !== "super_admin") {
        return;
      }

      const [{ data: teachers }, { data: classes }, { data: courses }, { data: syllabusData }] = await Promise.all([
        supabase.from("teachers").select("*").order("name", { ascending: true }),
        supabase.from("classes").select("*").order("sort_order"),
        supabase
          .from("courses")
          .select("*, class:classes(name, board)")
          .order("created_at", { ascending: false }),
        supabase.from("syllabus").select("*, class:classes(*)").order("subject"),
      ]);

      if (cancelled) return;

      setAdminPageCache("admin:teachers", teachers ?? []);
      setAdminPageCache("admin:courses", courses ?? []);
      setAdminPageCache("admin:materials:classes:admin", classes ?? []);
      setAdminPageCache("admin:qr:classes", classes ?? []);
      setAdminPageCache("admin:attendance:base:admin", {
        classes: classes ?? [],
        courses: ((courses ?? []) as Array<{ id: string; title: string; subject: string; class_id: string }>).map((course) => ({
          id: course.id,
          title: course.title,
          subject: course.subject,
          class_id: course.class_id,
        })),
      });
      setAdminPageCache("admin:syllabus:admin", {
        classes: classes ?? [],
        syllabi: syllabusData ?? [],
      });
    }

    void warmAdminCaches();

    return () => {
      cancelled = true;
    };
  }, [area, profile?.role, user?.id]);

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
    const profileId: string = userId;
    let cancelled = false;

    async function fetchQrToken() {
      const supabase = createClient();
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("profile_id", profileId)
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
    return () => {
      cancelled = true;
    };
  }, [isTuitionStudent, userId]);

  // ── Draw the QR code once the dialog's canvas exists ──
  useEffect(() => {
    if (!qrDialogOpen || !qrToken) return;

    let cancelled = false;

    const generateQrCode = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!qrCanvasRef.current || cancelled) return;

        const QRCode = (await import("qrcode")).default;

        if (cancelled) return;

        await QRCode.toCanvas(qrCanvasRef.current, qrToken, {
          width: 220,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
      } catch (error) {
        console.error("Failed to generate QR code:", error);
      }
    };

    void generateQrCode();

    return () => {
      cancelled = true;
    };
  }, [qrDialogOpen, qrToken]);

  const handleDownloadQr = useCallback(() => {
    if (!qrCanvasRef.current) return;
    const link = document.createElement("a");
    link.download = `my_qr_${fullName.replace(/\s+/g, "_")}.png`;
    link.href = qrCanvasRef.current.toDataURL("image/png");
    link.click();
  }, [fullName]);

  const groups = useMemo(() => {
    if (area === "admin") return isTeacherArea ? teacherNav : adminNav;
    return !studentTypeLoaded || isOnlineStudent ? onlineStudentNav : tuitionStudentNav;
  }, [area, isOnlineStudent, isTeacherArea, studentTypeLoaded]);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeHref = findActiveHref(pathname, flatItems);
  const activeGroup = groups.find((group) => group.items.some((item) => item.href === activeHref));
  const activeItem = flatItems.find((item) => item.href === activeHref);

  const commandItems = useMemo<CommandItem[]>(
    () => [
      ...groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
      { href: "/", label: "STC Academy website", group: "Public", icon: Globe },
    ],
    [groups],
  );

  const initials = fullName
    .split(" ")
    .map((part: string) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleLabel =
    area === "admin"
      ? isTeacherArea
        ? "Teacher"
        : profile?.role === "super_admin"
          ? "Super admin"
          : "Administrator"
      : isOnlineStudent
        ? "Online student"
        : "Student";

  const primaryAction =
    area === "admin" && !isTeacherArea
      ? adminPrimaryActions.find((action) => pathname.startsWith(action.prefix))
      : undefined;

  const supportHref = `mailto:stcinstindia@gmail.com?subject=${encodeURIComponent(
    area === "admin" ? "STC Admin Support" : "STC Student Support",
  )}`;

  const closeMenu = () => setMobileMenuOpen(false);

  const openQr = () => {
    closeMenu();
    setQrDialogOpen(true);
  };

  const renderRail = (collapsed: boolean) => (
    <div className="flex h-full flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center" : "px-4")}>
        <Link href={area === "admin" ? "/admin" : "/dashboard"} onClick={closeMenu} aria-label="STC Academy workspace">
          {collapsed ? <StcMark className="size-8 text-secondary" /> : <StcWordmark />}
        </Link>
      </div>

      <nav aria-label="Workspace" className="flex-1 space-y-3 overflow-y-auto px-3 py-1">
        {groups.map((group) => (
          <div key={group.label}>
            {collapsed ? null : <p className="mb-1 px-3 text-xs font-medium text-sidebar-foreground/70">{group.label}</p>}
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    data-active={isActive}
                    className={cn("stitch-sidebar-link", collapsed && "justify-center px-0")}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {collapsed ? null : <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {isTuitionStudent ? (
          <button
            type="button"
            onClick={openQr}
            title={collapsed ? "My QR code" : undefined}
            aria-label={collapsed ? "My QR code" : undefined}
            className={cn("stitch-sidebar-link text-left", collapsed && "justify-center px-0")}
          >
            <QrCode aria-hidden="true" className="size-4 shrink-0" />
            {collapsed ? null : <span className="truncate">My QR code</span>}
          </button>
        ) : null}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-sidebar-border px-3 py-3">
        <Link href="/" onClick={closeMenu} title={collapsed ? "Website" : undefined} aria-label={collapsed ? "Website" : undefined} className={cn("stitch-sidebar-link", collapsed && "justify-center px-0")}>
          <Globe aria-hidden="true" className="size-4 shrink-0" />
          {collapsed ? null : <span>Website</span>}
        </Link>
        <a href={supportHref} title={collapsed ? "Support" : undefined} aria-label={collapsed ? "Support" : undefined} className={cn("stitch-sidebar-link", collapsed && "justify-center px-0")}>
          <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />
          {collapsed ? null : <span>Support</span>}
        </a>
        <button
          type="button"
          onClick={() => void signOut()}
          title={collapsed ? "Sign out" : undefined}
          aria-label={collapsed ? "Sign out" : undefined}
          className={cn("stitch-sidebar-link text-left", collapsed && "justify-center px-0")}
        >
          <LogOut aria-hidden="true" className="size-4 shrink-0" />
          {collapsed ? null : <span>Sign out</span>}
        </button>

        <div className={cn("mt-2 flex items-center gap-3 rounded-lg pt-2", collapsed ? "justify-center" : "px-3")}>
          <span
            title={collapsed ? `${fullName}, ${roleLabel}` : undefined}
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
          >
            {initials}
          </span>
          {collapsed ? null : (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">{fullName}</span>
              <span className="block truncate text-xs text-sidebar-foreground/80">{roleLabel}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // The tasks people reach for on a phone, in thumb range.
  const tabs: Array<NavItem | { qr: true }> =
    area === "admin"
      ? isTeacherArea
        ? [
            { href: "/admin", label: "Dashboard", icon: LayoutGrid },
            { href: "/admin/qr-scan", label: "Scan", icon: ScanLine },
            { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
          ]
        : [
            { href: "/admin", label: "Dashboard", icon: LayoutGrid },
            { href: "/admin/students", label: "Students", icon: Users },
            { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
            { href: "/admin/qr-scan", label: "Scan", icon: ScanLine },
          ]
      : isTuitionStudent
        ? [
            { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
            { qr: true },
            { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
          ]
        : [
            { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
            { href: "/dashboard/syllabus", label: "Syllabus", icon: BookOpen },
            { href: "/dashboard/materials", label: "Materials", icon: FolderOpen },
          ];

  const tabClass =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-sidebar-foreground transition-colors duration-(--duration-fast)";

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-foreground lg:grid",
        railCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]",
      )}
    >
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[110] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <aside className="shell-rail no-print sticky top-0 hidden h-dvh lg:block">{renderRail(railCollapsed)}</aside>

      <div className="flex min-w-0 flex-col">
        {/* Desktop: where you are, then the one thing this page is for. */}
        <header className="shell-topbar no-print sticky top-0 z-30 hidden h-14 items-center gap-3 border-b bg-background px-6 lg:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => writeRail(!railCollapsed)}
            aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={railCollapsed}
          >
            {railCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </Button>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
            {activeGroup && activeGroup.items.length > 1 && activeGroup.label !== activeItem?.label ? (
              <>
                <span className="text-muted-foreground">{activeGroup.label}</span>
                <span aria-hidden="true" className="text-input">/</span>
              </>
            ) : null}
            <span className="font-semibold text-foreground">{activeItem?.label ?? "Workspace"}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 w-56 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-muted"
            >
              <Search aria-hidden="true" className="size-4" />
              <span>Go to…</span>
              <kbd className="ml-auto rounded border bg-muted px-1.5 font-sans text-xs">Ctrl K</kbd>
            </button>
          </div>
        </header>

        {/* Phone and tablet. */}
        <header className="no-print sticky top-0 z-30 lg:hidden">
          <div className="flex h-14 items-center justify-between gap-2 border-b bg-background px-4">
            <Link href={area === "admin" ? "/admin" : "/dashboard"} aria-label="STC Academy workspace">
              <StcWordmark />
            </Link>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Go to a page"
              className="ml-auto flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-muted"
            >
              <Search aria-hidden="true" className="size-5" />
            </button>
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                aria-label={primaryAction.label}
                className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
              >
                <Plus aria-hidden="true" className="size-5" />
              </Link>
            ) : null}
          </div>
        </header>

        <main id="workspace-content" className="min-w-0 flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      <nav aria-label="Quick links" className="shell-tabs no-print fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((tab) => {
          if ("qr" in tab) {
            return (
              <button key="qr" type="button" onClick={openQr} className={tabClass}>
                <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <QrCode aria-hidden="true" className="size-4" />
                </span>
                My QR
              </button>
            );
          }
          const Icon = tab.icon;
          const isActive = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(tabClass, isActive && "font-semibold text-foreground")}
            >
              <Icon aria-hidden="true" className="size-5" />
              {tab.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMobileMenuOpen(true)} className={tabClass}>
          <Menu aria-hidden="true" className="size-5" />
          More
        </button>
      </nav>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[86vw] max-w-xs gap-0 border-sidebar-border bg-sidebar p-0 **:data-[slot=sheet-close]:top-4 **:data-[slot=sheet-close]:text-sidebar-accent-foreground **:data-[slot=sheet-close]:hover:bg-sidebar-accent"
        >
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          {renderRail(false)}
        </SheetContent>
      </Sheet>

      <CommandPalette items={commandItems} open={paletteOpen} onOpenChange={setPaletteOpen} />

      {isTuitionStudent ? (
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>My QR code</DialogTitle>
              <DialogDescription>Show this to your teacher when you check in and check out.</DialogDescription>
            </DialogHeader>

            {qrToken ? (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="rounded-xl border bg-white p-3">
                  <canvas ref={qrCanvasRef} className="rounded-md" />
                </div>
                <Button variant="outline" onClick={handleDownloadQr}>
                  <Download aria-hidden="true" />
                  Save QR code
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-container-low p-8 text-center">
                <QrCode aria-hidden="true" className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Your QR code has not been created yet. Ask your teacher or the office to create it.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
