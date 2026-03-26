"use client";

import Image from "next/image";
import Link from "next/link";
import { LogIn, LogOut, Mail, MapPin, Phone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Reveal } from "@/components/stitch/reveal";

const navLinks = [
  { href: "/courses", label: "Curriculum" },
  { href: "/faculty", label: "Faculty" },
  { href: "/login", label: "Admissions" },
  { href: "/", label: "Academy" },
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
  const { user, role, loading, signOut } = useAuth();
  const dashboardHref = role === "admin" || role === "teacher" ? "/admin" : "/dashboard";
  const dashboardLabel =
    role === "admin"
      ? "Admin Dashboard"
      : role === "teacher"
        ? "Teacher Dashboard"
        : "Student Dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 z-50 w-full stitch-glass border-b border-black/[0.05]">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-6 px-6 py-5 md:px-12">
          <Reveal variant="fade">
            <Link href="/" className="inline-flex items-center leading-none" aria-label="STC Academy">
              <span className="relative block h-10 w-[180px] overflow-hidden md:h-11 md:w-[195px]">
                <Image
                  src="/logo.png"
                  alt="STC Academy"
                  fill
                  quality={100}
                  priority
                  className="object-cover object-center [image-rendering:auto]"
                />
              </span>
            </Link>
          </Reveal>

          <Reveal delay={60} variant="fade" className="hidden md:block">
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

          <Reveal delay={120} variant="fade" className="shrink-0">
            {loading ? (
              <div className="h-11 w-[168px] rounded-xl bg-white/70 stitch-ghost-border" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <Link href={dashboardHref} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                  {dashboardLabel}
                </Link>
                <button
                  type="button"
                  onClick={signOut}
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
                  href="/login"
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-105"
                >
                  Enroll Now
                </Link>
              </div>
            )}
          </Reveal>
        </div>
      </header>

      <main className="pt-24">{children}</main>

      <footer className="border-t border-black/[0.05] bg-background px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1.1fr]">
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

            <Reveal delay={160} variant="soft-zoom" className="space-y-5">
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

          <div className="mt-10 flex flex-col gap-4 border-t border-black/[0.05] pt-6 text-xs uppercase tracking-[0.18em] text-muted-foreground md:flex-row md:items-center md:justify-between">
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
