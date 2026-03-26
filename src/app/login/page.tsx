"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  stitchButtonClass,
  stitchInputClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";

type AuthMode = "login" | "signup";
type SignupStep = "form" | "otp";

interface PendingSignupState {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

async function resolveUserRole(userId: string): Promise<UserRole> {
  const supabase = createClient();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!error && profile?.role === "admin") {
      return "admin";
    }

    if (!error && profile?.role === "teacher") {
      return "teacher";
    }

    if (!error && profile?.role === "student") {
      return "student";
    }

    if (attempt < 3) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  }

  return "student";
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingSignup, setPendingSignup] = useState<PendingSignupState | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrapAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (user) {
        const role = await resolveUserRole(user.id);

        if (!active) {
          return;
        }

        router.replace(role === "admin" || role === "teacher" ? "/admin" : "/dashboard");
        router.refresh();
        return;
      }

      const redirectedFrom = searchParams.get("redirectedFrom");

      if (redirectedFrom) {
        setNotice("Please sign in to continue.");
      }

      setBootstrapping(false);
    };

    void bootstrapAuth();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!user) {
      setError("We could not complete sign-in. Please try again.");
      setLoading(false);
      return;
    }

    const role = await resolveUserRole(user.id);
    router.replace(role === "admin" || role === "teacher" ? "/admin" : "/dashboard");
    router.refresh();
    setLoading(false);
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const formData = new FormData(e.currentTarget);
    const signupData = {
      fullName: String(formData.get("full_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("signup_email") ?? "").trim().toLowerCase(),
      password: String(formData.get("signup_password") ?? ""),
    };

    const response = await fetch("/api/auth/send-signup-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    });

    const result = (await response.json()) as { error?: string; expiresInMinutes?: number };

    if (!response.ok) {
      setError(result.error ?? "Failed to send signup OTP.");
      setLoading(false);
      return;
    }

    setPendingSignup(signupData);
    setSignupStep("otp");
    setOtp("");
    setNotice(
      `We sent a verification code to ${signupData.email}. Enter it below within ${result.expiresInMinutes ?? 10} minutes.`,
    );
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/verify-signup-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
      email?: string;
      password?: string;
    };

    if (!response.ok || !result.success || !result.email || !result.password) {
      setError(result.error ?? "Failed to verify OTP.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email: result.email,
      password: result.password,
    });

    if (authError || !user) {
      setError(authError?.message ?? "Account verified, but automatic sign-in failed.");
      setMode("login");
      setSignupStep("form");
      setPendingSignup(null);
      setNotice("Your account is verified. Please sign in.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
    setLoading(false);
  }

  async function handleResendOtp() {
    if (!pendingSignup) {
      setError("Signup session expired. Please fill the form again.");
      setSignupStep("form");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/send-signup-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingSignup),
    });

    const result = (await response.json()) as { error?: string; expiresInMinutes?: number };

    if (!response.ok) {
      setError(result.error ?? "Failed to resend signup OTP.");
      setLoading(false);
      return;
    }

    setNotice(
      `A fresh verification code was sent to ${pendingSignup.email}. It expires in ${result.expiresInMinutes ?? 10} minutes.`,
    );
    setLoading(false);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setLoading(false);

    if (nextMode === "signup") {
      setSignupStep("form");
      setOtp("");
    }
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0">
        <div className="absolute left-[-10%] top-[-5%] h-[480px] w-[480px] rounded-full bg-primary/6 blur-[150px]" />
        <div className="absolute bottom-[-12%] right-[-5%] h-[420px] w-[420px] rounded-full bg-[#85a2b1]/6 blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <Link href="/" className="font-heading text-5xl text-primary">
            STC Academy
          </Link>
          <p className="mt-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Modern Scholar Portal
          </p>
        </div>

        <div className="rounded-[28px] border border-black/[0.06] bg-white p-7 shadow-[0_20px_90px_rgba(26,28,29,0.12)] backdrop-blur-xl">
          <div className="grid grid-cols-2 border-b border-black/[0.06]">
            <button
              type="button"
              className={`pb-4 text-sm font-medium transition ${
                mode === "login"
                  ? "border-b border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`pb-4 text-sm font-medium transition ${
                mode === "signup"
                  ? "border-b border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => switchMode("signup")}
            >
              Sign Up
            </button>
          </div>

          {notice ? (
            <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">Email Address</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="julian.voss@academy.edu"
                  className={stitchInputClass}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">Password</span>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="........"
                    className={cn(stitchInputClass, "pr-12")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                className={cn(stitchButtonClass, "h-14 w-full text-base")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Sign In to Student Portal"
                )}
              </button>
            </form>
          ) : signupStep === "form" ? (
            <form onSubmit={handleSignup} className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">Full Name</span>
                <input
                  name="full_name"
                  autoComplete="name"
                  required
                  placeholder="Julian Voss"
                  className={stitchInputClass}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">Phone Number</span>
                <input
                  name="phone"
                  autoComplete="tel"
                  required
                  placeholder="+91 98765 43210"
                  className={stitchInputClass}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">Email Address</span>
                <input
                  name="signup_email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="scholar@academy.edu"
                  className={stitchInputClass}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">Password</span>
                <input
                  name="signup_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  placeholder="Minimum 6 characters"
                  className={stitchInputClass}
                />
              </label>

              <button
                type="submit"
                className={cn(stitchButtonClass, "h-14 w-full text-base")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Signup OTP"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-7 space-y-5">
              <div className="rounded-2xl border border-black/[0.06] bg-muted px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Pending Signup
                </p>
                <p className="mt-2 text-sm text-foreground/70">{pendingSignup?.email}</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-muted-foreground">6-digit OTP</span>
                <input
                  name="signup_otp"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  placeholder="123456"
                  className={cn(stitchInputClass, "text-center text-lg tracking-[0.35em]")}
                />
              </label>

              <button
                type="submit"
                className={cn(stitchButtonClass, "h-14 w-full text-base")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify OTP and Create Account"
                )}
              </button>

              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setSignupStep("form");
                    setOtp("");
                    setError("");
                    setNotice("");
                  }}
                  className="transition-colors hover:text-foreground"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="transition-colors hover:text-primary"
                  disabled={loading}
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          <p className="mt-7 text-center text-xs leading-6 text-muted-foreground">
            By accessing the portal, you agree to our Academic Terms and Honor
            Code.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Support</span>
          <span>Language</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
