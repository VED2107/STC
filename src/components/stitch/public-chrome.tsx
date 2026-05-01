"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, Mail, MapPin, Menu, Phone } from "lucide-react";
import { getCachedStudentType, setCachedStudentType } from "@/lib/auth/client-cache";
import { useAuth } from "@/hooks/use-auth";
import { Reveal } from "@/components/stitch/reveal";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { StudentType } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const publicNavLinks = [
  { href: "/online-courses", label: "Online Courses" },
  { href: "/faculty", label: "Faculty" },
  { href: "/admissions", label: "Admissions" },
  { href: "/", label: "Academy" },
];

const studentNavLinks = [
  { href: "/dashboard/class", label: "Class" },
  { href: "/dashboard/syllabus", label: "Syllabus" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/attendance", label: "Attendance" },
];

const onlineStudentNavLinks = [
  { href: "/dashboard/class", label: "My Courses" },
  { href: "/dashboard/syllabus", label: "Syllabus" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/settings", label: "Settings" },
];

const adminNavLinks = [
  { href: "/admin/students", label: "Students" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/materials", label: "Materials" },
  { href: "/admin/attendance", label: "Attendance" },
];

const teacherNavLinks = [
  { href: "/admin/students", label: "Students" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/syllabus", label: "Syllabus" },
  { href: "/admin/materials", label: "Materials" },
];

const footerLinks = [
  { href: "/online-courses?level=primary", label: "Primary | Classes 1-5" },
  { href: "/online-courses?level=middle", label: "Middle | Classes 6-8" },
  { href: "/online-courses?level=ssc", label: "SSC | Board Prep" },
  { href: "/online-courses?level=hsc", label: "11th / HSC" },
  { href: "/online-courses?level=hsc&track=jee", label: "JEE Preparation" },
  { href: "/online-courses?level=hsc&track=neet", label: "NEET Preparation" },
];

const contactDetails = [
  {
    label: "Campus",
    value: "STC found us",
    href: "https://share.google/E1n2yltTbAqfN9UAd",
    icon: MapPin,
  },
  {
    label: "Call",
    value: "7016072398, 8160576043",
    href: "tel:7016072398",
    icon: Phone,
  },
  {
    label: "Write",
    value: "stcinstindia@gmail.com",
    href: "mailto:stcinstindia@gmail.com",
    icon: Mail,
  },
];

export function PublicChrome({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, role, loading, signOut } = useAuth();
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const isRoleResolved = !user || !!role;
  const isAdminRole = role === "admin" || role === "super_admin";
  const dashboardHref =
    isAdminRole ? "/admin" : role === "teacher" ? "/admin/attendance" : "/dashboard";
  const dashboardLabel =
    isAdminRole
      ? "Admin Dashboard"
      : role === "teacher"
        ? "Teacher Dashboard"
        : "Student Dashboard";
  const navLinks = useMemo(() => {
    if (!user || !role) {
      return publicNavLinks;
    }

    if (isAdminRole) {
      return adminNavLinks;
    }

    if (role === "teacher") {
      return teacherNavLinks;
    }

    if (studentType === "online") {
      return onlineStudentNavLinks;
    }

    return studentNavLinks;
  }, [isAdminRole, role, studentType, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadStudentType() {
      if (!user || role !== "student") {
        setStudentType(null);
        return;
      }

      const cachedStudentType = getCachedStudentType(user.id);
      if (cachedStudentType) {
        setStudentType(cachedStudentType);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("students")
        .select("student_type")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Failed to load student type:", error.message);

        if (!cancelled) {
          setStudentType(null);
        }

        return;
      }

      if (!cancelled) {
        const resolvedStudentType =
          ((data as { student_type?: StudentType } | null)?.student_type ?? "tuition");
        setCachedStudentType(user.id, resolvedStudentType);
        setStudentType(resolvedStudentType);
      }
    }

    void loadStudentType();

    return () => {
      cancelled = true;
    };
  }, [role, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const hasAuthCode = currentUrl.searchParams.has("code");
    const hasAuthError = currentUrl.searchParams.has("error");

    if (!hasAuthCode && !hasAuthError) {
      return;
    }

    currentUrl.searchParams.delete("code");
    currentUrl.searchParams.delete("error");
    currentUrl.searchParams.delete("error_code");
    currentUrl.searchParams.delete("error_description");
    window.history.replaceState({}, "", currentUrl.toString());
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 z-50 w-full stitch-glass border-b border-black/5">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 md:gap-6 md:px-12 md:py-5">
          <Reveal variant="fade">
            <Link href="/" className="inline-flex items-center leading-none" aria-label="STC Academy">
              <span className="font-heading text-2xl italic text-foreground sm:text-3xl">
                STC Academy
              </span>
            </Link>
          </Reveal>

          <Reveal delay={60} variant="fade" className="hidden lg:block">
            <nav className="flex items-center gap-8">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="font-heading text-lg italic tracking-tight text-foreground/60 transition-colors hover:text-secondary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </Reveal>

          <Reveal delay={120} variant="fade" className="hidden shrink-0 lg:block">
            {loading || !isRoleResolved ? (
              <div className="h-11 w-[168px] rounded-xl bg-white/70 stitch-ghost-border" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <Link href={dashboardHref} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                  {dashboardLabel}
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-foreground stitch-ghost-border transition hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-foreground stitch-ghost-border transition hover:bg-muted"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
                <Link
                  href="/enroll"
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
                >
                  Enroll Now
                </Link>
              </div>
            )}
          </Reveal>

          <div className="flex items-center gap-2 lg:hidden">
            {!loading && isRoleResolved ? (
              user ? (
                <Link href={dashboardHref} className={cn(buttonVariants({ size: "sm" }), "h-10 rounded-xl px-3")}>
                  {isAdminRole ? "Admin" : role === "teacher" ? "Teacher" : "Student"}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-10 rounded-xl px-3"
                  )}
                >
                  Login
                </Link>
              )
            ) : null}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-10 w-10 rounded-xl")}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </SheetTrigger>
              <SheetContent side="right" className="w-[86vw] max-w-sm bg-background p-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Navigate
                    </p>
                    <nav className="grid gap-1">
                      {navLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                  </div>

                  <div className="space-y-2">
                    {user ? (
                      <>
                        <Link
                          href={dashboardHref}
                          onClick={() => setMenuOpen(false)}
                          className={cn(buttonVariants(), "w-full rounded-xl")}
                        >
                          {dashboardLabel}
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            void signOut();
                          }}
                          className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl")}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          onClick={() => setMenuOpen(false)}
                          className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl")}
                        >
                          <LogIn className="mr-2 h-4 w-4" />
                          Login
                        </Link>
                        <Link
                          href="/enroll"
                          onClick={() => setMenuOpen(false)}
                          className={cn(buttonVariants(), "w-full rounded-xl")}
                        >
                          Enroll Now
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="pt-20 sm:pt-24">{children}</main>

      <footer className="border-t border-black/5 bg-background px-6 py-10 md:px-12 md:py-14">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-8 md:gap-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.1fr]">
            <Reveal variant="fade-up" className="space-y-5">
              <div className="font-heading text-3xl italic text-foreground">STC Academy</div>
              <p className="max-w-lg text-base leading-8 text-muted-foreground">
                Dedicated to quality education with strong study materials, expert mentorship,
                and reliable academic support for Gujarat families.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="stitch-pill bg-accent text-accent-foreground">CBSE</span>
                <span className="stitch-pill">GSEB</span>
                <span className="stitch-pill">Primary to HSC</span>
              </div>
            </Reveal>

            <Reveal delay={80} variant="fade-up" className="space-y-5">
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Academic Tracks</h3>
              <div className="grid grid-cols-2 gap-2 md:hidden">
                {footerLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex min-h-[84px] rounded-[20px] bg-muted px-4 py-3 text-sm leading-5 text-foreground/78 stitch-ghost-border transition-all hover:-translate-y-0.5 hover:text-secondary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="hidden flex-col gap-3 md:flex">
                {footerLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="text-sm text-foreground/68 transition-colors hover:text-secondary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </Reveal>

            <Reveal delay={160} variant="soft-zoom" className="space-y-5 md:col-span-2 lg:col-span-1">
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Contact</h3>
              <div className="grid grid-cols-2 gap-3 md:hidden">
                {contactDetails.map((item, index) => {
                  const Icon = item.icon;
                  const isWide = index === contactDetails.length - 1;

                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className={cn(
                        "rounded-[22px] bg-muted p-4 stitch-ghost-border transition-all hover:-translate-y-0.5 hover:bg-white/90",
                        isWide && "col-span-2"
                      )}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-secondary stitch-ghost-border">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="mt-4 space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                          {item.label}
                        </div>
                        <div className="text-sm leading-6 text-foreground/80">{item.value}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
              <div className="hidden rounded-[24px] bg-muted p-6 stitch-ghost-border md:block">
                <div className="space-y-4">
                  {contactDetails.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-secondary stitch-ghost-border">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            {item.label}
                          </div>
                          {item.href ? (
                            <a href={item.href} className="mt-1 block text-sm text-foreground/80 hover:text-secondary">
                              {item.value}
                            </a>
                          ) : (
                            <div className="mt-1 text-sm text-foreground/80">{item.value}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>

          <div className="mt-10 border-t border-black/5 pt-6 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Reveal variant="fade" className="rounded-[20px] bg-muted/55 p-4 stitch-ghost-border md:border-0 md:bg-transparent md:p-0">
              <p>&copy; {new Date().getFullYear()} STC Academy. Designed for the Modern Scholar.</p>
            </Reveal>
            <Reveal
              delay={80}
              variant="fade"
              className="mt-3 grid grid-cols-2 gap-3 md:mt-4 lg:flex lg:flex-wrap lg:gap-5"
            >
              <span className="rounded-[20px] bg-muted/55 p-4 stitch-ghost-border md:border-0 md:bg-transparent md:p-0">
                Mon-Sat | 8:00 AM - 8:00 PM
              </span>
              <span className="col-span-2 rounded-[20px] bg-muted/55 p-4 leading-5 stitch-ghost-border md:col-span-1 md:border-0 md:bg-transparent md:p-0 md:leading-normal">
                Focused learning environment with active admissions support
              </span>
            </Reveal>
          </div>
        </div>
      </footer>
    </div>
  );
}
