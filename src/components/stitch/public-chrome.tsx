"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Mail, MapPin, Menu, Phone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { StcWordmark } from "@/components/stitch/primitives";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/online-courses", label: "Online courses" },
  { href: "/faculty", label: "Faculty" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/about-us", label: "About" },
];

const trackLinks = [
  { href: "/online-courses?level=primary", label: "Primary, Classes 1 to 5" },
  { href: "/online-courses?level=middle", label: "Middle, Classes 6 to 8" },
  { href: "/online-courses?level=ssc", label: "SSC board preparation" },
  { href: "/online-courses?level=hsc", label: "11th and HSC" },
  { href: "/online-courses?level=hsc&track=jee", label: "JEE preparation" },
  { href: "/online-courses?level=hsc&track=neet", label: "NEET preparation" },
];

const siteLinks = [
  { href: "/about-us", label: "About STC" },
  { href: "/faculty", label: "Faculty" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/materials", label: "Study materials" },
  { href: "/credits", label: "Credits" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const headerActionClass =
  "stitch-press inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-(--duration-fast)";

export function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, role, loading, signOut } = useAuth();
  const isRoleResolved = !user || !!role;
  const isAdminRole = role === "admin" || role === "super_admin";
  const dashboardHref = isAdminRole || role === "teacher" ? "/admin" : "/dashboard";

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has("code") && !currentUrl.searchParams.has("error")) {
      return;
    }

    currentUrl.searchParams.delete("code");
    currentUrl.searchParams.delete("error");
    currentUrl.searchParams.delete("error_code");
    currentUrl.searchParams.delete("error_description");
    window.history.replaceState({}, "", currentUrl.toString());
  }, []);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[110] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="site-header sticky top-0 z-50 border-b bg-background text-foreground">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" aria-label="STC Academy home" className="rounded-md">
            <StcWordmark />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors duration-(--duration-fast) hover:bg-muted",
                  isCurrent(item.href) ? "text-secondary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Keep the slot's width while auth resolves, so the header does not jump. */}
            <div className="hidden min-w-44 justify-end gap-2 lg:flex">
              {loading || !isRoleResolved ? null : user ? (
                <>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className={cn(headerActionClass, "text-foreground hover:bg-muted")}
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    Sign out
                  </button>
                  <Link href={dashboardHref} className={cn(headerActionClass, "bg-accent text-accent-foreground hover:bg-accent/85")}>
                    My dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className={cn(headerActionClass, "text-foreground hover:bg-muted")}>
                    Sign in
                  </Link>
                  <Link href="/enroll" className={cn(headerActionClass, "bg-accent text-accent-foreground hover:bg-accent/85")}>
                    Enroll now
                  </Link>
                </>
              )}
            </div>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                aria-label="Open menu"
                className="flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-muted lg:hidden"
              >
                <Menu aria-hidden="true" className="size-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[86vw] max-w-sm gap-6 p-6">
                <SheetTitle className="text-xl">Menu</SheetTitle>
                <SheetDescription className="sr-only">Site navigation links</SheetDescription>
                <nav aria-label="Mobile" className="grid gap-1">
                  {navLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isCurrent(item.href) ? "page" : undefined}
                      className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium hover:bg-muted"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-auto grid gap-2">
                  {user ? (
                    <>
                      <Link href={dashboardHref} onClick={() => setMenuOpen(false)} className={cn(headerActionClass, "min-h-11 bg-primary text-primary-foreground")}>
                        My dashboard
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut();
                        }}
                        className={cn(headerActionClass, "min-h-11 border border-input bg-card text-foreground")}
                      >
                        <LogOut aria-hidden="true" className="size-4" />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/enroll" onClick={() => setMenuOpen(false)} className={cn(headerActionClass, "min-h-11 bg-primary text-primary-foreground")}>
                        Enroll now
                      </Link>
                      <Link href="/login" onClick={() => setMenuOpen(false)} className={cn(headerActionClass, "min-h-11 border border-input bg-card text-foreground")}>
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="bg-surface-container-low text-muted-foreground">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 md:grid-cols-2 md:px-8 lg:grid-cols-[1.4fr_1fr_0.8fr_1.2fr]">
          <div>
            <StcWordmark />
            <p className="mt-4 max-w-sm text-sm leading-6">
              Saraswati Tuition Classes in Patan, Gujarat. CBSE and GSEB coaching from Primary to HSC, with study materials and steady academic support.
            </p>
          </div>

          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">Courses</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {trackLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-secondary">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">STC</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {siteLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-secondary">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">Contact</h2>
            <ul className="mt-3 grid gap-3 text-sm">
              <li>
                <a href="https://share.google/E1n2yltTbAqfN9UAd" target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-secondary">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  Find us on Google Maps
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="tnum">
                  <a href="tel:7016072398" className="hover:text-secondary">7016072398</a>
                  {", "}
                  <a href="tel:8160576043" className="hover:text-secondary">8160576043</a>
                </span>
              </li>
              <li>
                <a href="mailto:stcinstindia@gmail.com" className="flex items-start gap-2 break-all hover:text-secondary">
                  <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  stcinstindia@gmail.com
                </a>
              </li>
              <li>Monday to Saturday, 8:00 AM to 8:00 PM</li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <p className="mx-auto max-w-[1280px] px-4 py-4 text-xs md:px-8">
            &copy; {new Date().getFullYear()} STC Academy
          </p>
        </div>
      </footer>
    </div>
  );
}
