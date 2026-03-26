import Link from "next/link";
import { GraduationCap, Phone, Mail, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const quickLinks = [
  { href: "/courses", label: "Courses" },
  { href: "/teachers", label: "Teachers" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/materials", label: "Materials" },
  { href: "/about", label: "About Us" },
];

const classLinks = [
  { href: "/courses?level=1-5", label: "Class 1–5" },
  { href: "/courses?level=6-9", label: "Class 6–9" },
  { href: "/courses?level=SSC", label: "SSC" },
  { href: "/courses?level=HSC", label: "HSC" },
];

export function Footer() {
  return (
    <footer className="border-t border-[rgba(108,92,231,0.12)] bg-[#08081a]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0] to-[#00d2d3] text-white shadow-[0_0_15px_rgba(108,92,231,0.25)]">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-[#7c6cf0] to-[#00d2d3] bg-clip-text text-transparent">STC</span>
            </Link>
            <p className="text-sm text-[#9994c0] leading-relaxed">
              Shaping tomorrow&apos;s leaders through quality education. 
              Coaching classes for Class 1 to HSC — GSEB &amp; NCERT board.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#c8c4e0]">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#9994c0] transition-colors hover:text-[#00d2d3]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Classes */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#c8c4e0]">
              Classes
            </h3>
            <ul className="space-y-2.5">
              {classLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#9994c0] transition-colors hover:text-[#00d2d3]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#c8c4e0]">
              Contact Us
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-[#9994c0]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#00d2d3]" />
                <span>STC Tuition Centre, Gujarat, India</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-[#9994c0]">
                <Phone className="h-4 w-4 shrink-0 text-[#00d2d3]" />
                <span>+91 99999 99999</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-[#9994c0]">
                <Mail className="h-4 w-4 shrink-0 text-[#00d2d3]" />
                <span>info@stctuition.com</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="bg-[rgba(108,92,231,0.12)]" />

        <div className="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-xs text-[#9994c0]">
            &copy; {new Date().getFullYear()} STC Tuition Centre. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-[#9994c0]">
            <Link href="/privacy" className="transition-colors hover:text-[#00d2d3]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[#00d2d3]">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
