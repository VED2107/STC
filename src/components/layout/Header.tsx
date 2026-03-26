"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import {
  GraduationCap,
  Menu,
  BookOpen,
  Users,
  Info,
  FileText,
  FolderOpen,
  LogIn,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

const navLinks = [
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/syllabus", label: "Syllabus", icon: FileText },
  { href: "/materials", label: "Materials", icon: FolderOpen },
  { href: "/about", label: "About", icon: Info },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, role, loading, signOut } = useAuth();

  const isLoggedIn = !!user;
  const dashboardHref = role === "admin" || role === "teacher" ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(108,92,231,0.12)] bg-[#0a0a1a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0] to-[#00d2d3] text-white transition-transform group-hover:scale-105 shadow-[0_0_20px_rgba(108,92,231,0.3)]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#7c6cf0] to-[#00d2d3] bg-clip-text text-transparent font-[var(--font-heading)]">
            STC
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm font-medium text-[#9994c0] rounded-md transition-colors hover:text-white hover:bg-[rgba(108,92,231,0.1)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          {!loading && (
            <>
              {isLoggedIn ? (
                <>
                  <Link href={dashboardHref} className={cn(buttonVariants({ size: "sm" }), "gap-1.5 bg-[#7c6cf0] hover:bg-[#6c5ce7] text-white shadow-[0_0_15px_rgba(108,92,231,0.3)]")}>
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-[#9994c0] hover:text-white hover:bg-[rgba(108,92,231,0.1)]")}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-[#9994c0] hover:text-white hover:bg-[rgba(108,92,231,0.1)]")}>
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Login
                  </Link>
                  <Link href="/enroll" className={cn(buttonVariants({ size: "sm" }), "bg-gradient-to-r from-[#7c6cf0] to-[#00d2d3] hover:from-[#6c5ce7] hover:to-[#00bfbf] text-white shadow-[0_0_20px_rgba(108,92,231,0.3)] border-0")}>
                    Enroll Now
                  </Link>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {!loading && (
            <>
              {isLoggedIn ? (
                <>
                  <Link
                    href={dashboardHref}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-[#9994c0] hover:text-white")}
                    aria-label="Dashboard"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                  </Link>
                  <button
                    onClick={() => void signOut()}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-[#9994c0] hover:text-white")}
                    aria-label="Logout"
                    type="button"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-[#9994c0] hover:text-white")}
                  aria-label="Login"
                >
                  <LogIn className="h-5 w-5" />
                </Link>
              )}
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden text-[#9994c0] hover:text-white")}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-[#0f0d28] border-l border-[rgba(108,92,231,0.15)]">
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className="flex items-center gap-2"
                onClick={() => setOpen(false)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0] to-[#00d2d3] text-white">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-[#7c6cf0] to-[#00d2d3] bg-clip-text text-transparent">STC</span>
              </Link>
            </div>
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#9994c0] transition-colors hover:text-white hover:bg-[rgba(108,92,231,0.1)]"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-8 flex flex-col gap-2">
              {!loading && (
                <>
                  {isLoggedIn ? (
                    <>
                      <Link href={dashboardHref} onClick={() => setOpen(false)} className={cn(buttonVariants(), "bg-[#7c6cf0] hover:bg-[#6c5ce7] text-white")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                      <button
                        type="button"
                        onClick={() => { setOpen(false); void signOut(); }}
                        className={cn(buttonVariants({ variant: "outline" }), "w-full border-[rgba(108,92,231,0.3)] text-[#9994c0] hover:text-white hover:bg-[rgba(108,92,231,0.1)]")}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: "outline" }), "border-[rgba(108,92,231,0.3)] text-[#9994c0] hover:text-white hover:bg-[rgba(108,92,231,0.1)]")}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Login
                      </Link>
                      <Link href="/enroll" onClick={() => setOpen(false)} className={cn(buttonVariants(), "bg-gradient-to-r from-[#7c6cf0] to-[#00d2d3] text-white border-0")}>
                        Enroll Now
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
