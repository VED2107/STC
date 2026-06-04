"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LOGIN_FLAG = "stc:just-logged-in";

export function markJustLoggedIn(isNew?: boolean) {
  try {
    sessionStorage.setItem(LOGIN_FLAG, isNew ? "new" : "1");
  } catch {}
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

interface WelcomeGreetingProps {
  name: string;
  isNewUser?: boolean;
}

export function WelcomeGreeting({ name, isNewUser }: WelcomeGreetingProps) {
  const checkedRef = useRef(false);
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);
  const [freshSignup, setFreshSignup] = useState(false);
  const [phase, setPhase] = useState<"idle" | "check" | "text" | "exit" | "done">("idle");

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let flag: string | null = null;
    try {
      flag = sessionStorage.getItem(LOGIN_FLAG);
      if (flag) sessionStorage.removeItem(LOGIN_FLAG);
    } catch {}

    // Also trigger on ?login=1 from OAuth callback
    if (!flag) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === "1") {
        flag = "1";
        params.delete("login");
        const clean = params.toString();
        const path = window.location.pathname + (clean ? `?${clean}` : "");
        window.history.replaceState({}, "", path);
      }
    }

    if (!flag) {
      setShouldShow(false);
      return;
    }

    if (flag === "new") setFreshSignup(true);
    setShouldShow(true);
  }, []);

  useEffect(() => {
    if (!shouldShow) return;

    const t1 = window.setTimeout(() => setPhase("check"), 50);
    const t2 = window.setTimeout(() => setPhase("text"), 500);
    const t3 = window.setTimeout(() => setPhase("exit"), 2600);
    const t4 = window.setTimeout(() => setPhase("done"), 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [shouldShow]);

  if (shouldShow === null || shouldShow === false || phase === "done") return null;

  const firstName = name.split(" ")[0] || "Scholar";
  const greeting = getTimeGreeting();
  const isNew = isNewUser || freshSignup;
  const headline = isNew ? "Welcome to STC Academy" : `${greeting}, ${firstName}`;
  const subtitle = isNew
    ? "Your account is ready. Let's get started."
    : "Great to see you again.";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-500",
        phase === "exit" ? "pointer-events-none opacity-0 scale-105" : "opacity-100 scale-100",
      )}
      style={{ backgroundColor: "#030304" }}
      aria-live="polite"
    >
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#fed65b]/8 blur-[180px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-[#735c00]/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-[15%] top-[25%] h-[200px] w-[200px] rounded-full bg-[#fed65b]/6 blur-[100px]" />

      {/* Dot pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Checkmark */}
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-500",
            phase === "idle"
              ? "scale-50 opacity-0 border-transparent bg-transparent"
              : "scale-100 opacity-100 border-[#fed65b]/30 bg-[#fed65b]/10",
          )}
        >
          <CheckCircle2
            className={cn(
              "h-10 w-10 transition-all duration-400",
              phase === "idle"
                ? "scale-0 opacity-0 text-transparent"
                : "scale-100 opacity-100 text-[#fed65b]",
            )}
          />
        </div>

        {/* Headline */}
        <h1
          className={cn(
            "mt-8 text-3xl font-light text-white transition-all duration-500 sm:text-4xl md:text-5xl",
          )}
          style={{
            fontFamily: "var(--font-heading), serif",
            letterSpacing: "-0.03em",
            opacity: phase === "text" || phase === "exit" ? 1 : 0,
            transform: phase === "text" || phase === "exit" ? "translateY(0)" : "translateY(16px)",
          }}
        >
          {headline}
        </h1>

        {/* Subtitle */}
        <p
          className="mt-4 text-base text-white/50 transition-all duration-500"
          style={{
            transitionDelay: "200ms",
            opacity: phase === "text" || phase === "exit" ? 1 : 0,
            transform: phase === "text" || phase === "exit" ? "translateY(0)" : "translateY(12px)",
          }}
        >
          {subtitle}
        </p>

        {/* Gold accent line */}
        <div
          className="mt-8 h-px transition-all duration-700"
          style={{
            background: "linear-gradient(to right, transparent, rgba(254,214,91,0.4), transparent)",
            width: phase === "text" || phase === "exit" ? "128px" : "0px",
            opacity: phase === "text" || phase === "exit" ? 1 : 0,
          }}
        />
      </div>
    </div>
  );
}
