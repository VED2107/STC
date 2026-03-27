"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, Mail, MapPin, Menu, Phone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Reveal } from "@/components/stitch/reveal";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { StudentType } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const publicNavLinks = [
  { href: "/courses", label: "Curriculum" },
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
  { href: "/admin/courses", label: "Courses" },
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
  { href: "/courses?level=primary", label: "Primary | Classes 1-5" },
  { href: "/courses?level=middle", label: "Middle | Classes 6-8" },
  { href: "/courses?level=ssc", label: "SSC | Board Prep" },
  { href: "/courses?level=hsc", label: "11th / HSC" },
  { href: "/courses?level=hsc&track=jee", label: "JEE Preparation" },
  { href: "/courses?level=hsc&track=neet", label: "NEET Preparation" },
];

const contactDetails = [
  {
    label: "Campus",
    value: "STC Tuition Centre, Gujarat, India",
    href: null,
    icon: MapPin,
  },
  {
    label: "Call",
    value: "+91 99999 99999",
    href: "tel:+919999999999",
    icon: Phone,
  },
  {
    label: "Write",
    value: "info@stctuition.com",
    href: "mailto:info@stctuition.com",
    icon: Mail,
  },
];

export function PublicChrome({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, role, loading, signOut } = useAuth();
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const isRoleResolved = !user || !!role;
  const dashboardHref = role === "admin" || role === "teacher" ? "/admin" : "/dashboard";
  const dashboardLabel =
    role === "admin"
      ? "Admin Dashboard"
      : role === "teacher"
        ? "Teacher Dashboard"
        : "Student Dashboard";
  const navLinks = useMemo(() => {
    if (!user || !role) {
      return publicNavLinks;
    }

    if (role === "admin") {
      return adminNavLinks;
    }

    if (role === "teacher") {
      return teacherNavLinks;
    }

    if (studentType === "online") {
      return onlineStudentNavLinks;
    }

    return studentNavLinks;
  }, [role, studentType, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadStudentType() {
      if (!user || role !== "student") {
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
          ((data as { student_type?: StudentType } | null)?.student_type ?? "tuition"),
        );
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
    window.history.replaceState({}, "", currentUrl.toString());
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 z-50 w-full stitch-glass border-b border-black/[0.05]">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 md:gap-6 md:px-12 md:py-5">
          <Reveal variant="fade">
            <Link href="/" className="inline-flex items-center leading-none" aria-label="STC Academy">
              <span className="relative block h-9 w-[155px] overflow-hidden sm:h-10 sm:w-[180px] md:h-11 md:w-[195px]">
                <Image
                  src="/logo.png"
                  alt="STC Academy"
                  fill
                  quality={100}
                  priority
                  sizes="(max-width: 640px) 155px, (max-width: 768px) 180px, 195px"
                  className="object-cover object-center [image-rendering:auto]"
                />
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

          <Reveal delay={120} variant="fade" className="hidden shrink-0 sm:block">
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

          <div className="flex items-center gap-2 sm:hidden">
            {!loading && isRoleResolved ? (
              user ? (
                <Link href={dashboardHref} className={cn(buttonVariants({ size: "sm" }), "h-10 rounded-xl px-3")}>
                  {role === "admin" ? "Admin" : role === "teacher" ? "Teacher" : "Student"}
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

      <footer className="border-t border-black/[0.05] bg-background px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.1fr]">
            <Reveal variant="fade-up" className="space-y-5">
              <div className="font-heading text-3xl italic text-foreground">STC Academy</div>
              <p className="max-w-lg text-base leading-8 text-muted-foreground">
                Dedicated to quality education with strong study materials, expert mentorship,
                and reliable academic support for Gujarat families.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="stitch-pill bg-accent text-accent-foreground">NCERT</span>
                <span className="stitch-pill">GSEB</span>
                <span className="stitch-pill">Primary to HSC</span>
              </div>
            </Reveal>

            <Reveal delay={80} variant="fade-up" className="space-y-5">
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Academic Tracks</h3>
              <div className="flex flex-col gap-3">
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
              <div className="rounded-[24px] bg-muted p-6 stitch-ghost-border">
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

          <div className="mt-10 flex flex-col gap-4 border-t border-black/[0.05] pt-6 text-xs uppercase tracking-[0.18em] text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <Reveal variant="fade">
              <p>&copy; {new Date().getFullYear()} STC Academy. Designed for the Modern Scholar.</p>
            </Reveal>
            <Reveal delay={80} variant="fade" className="flex flex-wrap gap-5">
              <span>Mon-Sat | 8:00 AM - 8:00 PM</span>
              <span>Focused learning environment with active admissions support</span>
            </Reveal>
          </div>
        </div>
      </footer>
    </div>
  );
}
