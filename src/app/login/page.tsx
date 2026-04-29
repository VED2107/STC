"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  PencilLine,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { getCachedRole, setCachedProfile } from "@/lib/auth/client-cache";
import { createClient } from "@/lib/supabase/client";
import {
  stitchButtonClass,
  stitchInputClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { cn } from "@/lib/utils";
import type { Profile, UserRole } from "@/lib/types/database";

type AuthMode = "login" | "signup";
type SignupStep = "form" | "otp";
type LoginMethod = "password" | "otp";

interface PendingSignupState {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

type AuthActionPrompt = "signup" | null;

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        d="M21.805 10.023H12.24v3.955h5.48c-.236 1.273-.945 2.352-2.009 3.08v2.558h3.254c1.904-1.754 3-4.337 3-7.393 0-.728-.065-1.427-.16-2.2Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 22c2.73 0 5.02-.903 6.694-2.444l-3.254-2.558c-.903.604-2.058.962-3.44.962-2.645 0-4.887-1.785-5.685-4.187H3.196v2.638A10.109 10.109 0 0 0 12.24 22Z"
        fill="#34A853"
      />
      <path
        d="M6.555 13.773a6.083 6.083 0 0 1 0-3.876V7.26H3.196a10.109 10.109 0 0 0 0 9.151l3.359-2.638Z"
        fill="#FBBC04"
      />
      <path
        d="M12.24 5.71c1.484 0 2.816.51 3.865 1.51l2.9-2.9C17.256 2.692 14.966 2 12.24 2A10.109 10.109 0 0 0 3.196 7.26l3.359 2.637C7.353 7.495 9.595 5.71 12.24 5.71Z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface OtpDeliveryPanelProps {
  title: string;
  eyebrow: string;
  email: string;
  description: string;
  editLabel: string;
  resendLabel: string;
  loading: boolean;
  onEdit: () => void;
  onResend: () => void;
}

function OtpDeliveryPanel({
  title,
  eyebrow,
  email,
  description,
  editLabel,
  resendLabel,
  loading,
  onEdit,
  onResend,
}: OtpDeliveryPanelProps) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-black/6 bg-linear-to-br from-[#fffaf0] via-white to-[#f5f7fb]">
      <div className="border-b border-black/6 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-secondary/75">
              {eyebrow}
            </p>
            <h3 className="mt-2 flex items-center gap-2 text-xl text-primary">
              <MailCheck className="h-5 w-5 text-secondary" />
              {title}
            </h3>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure delivery
          </span>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="rounded-[22px] border border-black/6 bg-white/90 p-4 shadow-[0_18px_34px_-28px_rgba(26,28,29,0.22)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Destination inbox
          </p>
          <p className="mt-2 break-all text-base font-medium text-foreground">{email}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        <div className="grid gap-3 rounded-[22px] border border-dashed border-black/8 bg-white/55 p-4 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 text-secondary" />
            <p>Check spam or promotions if the email does not land in your main inbox.</p>
          </div>
          <div className="flex items-start gap-3">
            <MailCheck className="mt-0.5 h-4 w-4 text-secondary" />
            <p>Enter the most recent 6-digit code only. Older codes stop working after resend.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/8 bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <PencilLine className="h-4 w-4" />
            {editLabel}
          </button>
          <button
            type="button"
            onClick={onResend}
            className={cn(stitchSecondaryButtonClass, "gap-2 px-4 py-3")}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {resendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function getRoleHome(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/admin/attendance";
  return "/dashboard";
}

/**
 * Fetch the user's profile (with retries for eventual-consistency),
 * cache it, and return the correct post-login redirect path.
 */
async function resolvePostLoginPath(userId: string): Promise<string> {
  const cachedRole = getCachedRole(userId);
  const supabase = createClient();

  // The profile is usually created by a DB trigger; retry a few times
  // in case it hasn't been committed yet.
  let profile: Profile | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      profile = data as Profile;
      break;
    }

    if (attempt < 3) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  }

  if (profile) {
    setCachedProfile(profile);
  }

  const resolvedRole =
    profile?.role === "admin" || profile?.role === "teacher" || profile?.role === "student"
      ? profile.role
      : cachedRole ?? "student";

  if (resolvedRole === "student") {
    const hasFullName = Boolean(profile?.full_name?.trim());
    const hasPhone = Boolean(profile?.phone?.trim());

    if (!hasFullName || !hasPhone) {
      return "/dashboard/settings?onboarding=1";
    }
  }

  return getRoleHome(resolvedRole);
}

async function ensureStudentAccess() {
  await fetch("/api/auth/ensure-student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => null);
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingSignup, setPendingSignup] = useState<PendingSignupState | null>(null);
  const [authActionPrompt, setAuthActionPrompt] = useState<AuthActionPrompt>(null);

  useEffect(() => {
    let active = true;

    const bootstrapAuth = async () => {
      const supabase = createClient();
      const authCode = searchParams.get("code");

      if (authCode) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);

        if (!active) {
          return;
        }

        if (exchangeError) {
          setError(exchangeError.message);
          setBootstrapping(false);
          return;
        }

        if (typeof window !== "undefined") {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          window.history.replaceState({}, "", cleanUrl.toString());
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (user) {
        await ensureStudentAccess();
        const defaultPath = await resolvePostLoginPath(user.id);

        if (!active) {
          return;
        }

        const redirectedFrom = searchParams.get("redirectedFrom");
        router.replace(
          redirectedFrom && redirectedFrom.startsWith("/")
            ? redirectedFrom
            : defaultPath,
        );
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

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
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

    await ensureStudentAccess();
    const defaultPath = await resolvePostLoginPath(user.id);
    const redirectedFrom = searchParams.get("redirectedFrom");
    router.replace(
      redirectedFrom && redirectedFrom.startsWith("/")
        ? redirectedFrom
        : defaultPath,
    );
    router.refresh();
    setLoading(false);
  }

  async function handleSendLoginOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setAuthActionPrompt(null);

    const normalizedEmail = loginEmail.trim().toLowerCase();

    const response = await fetch("/api/auth/send-login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    const result = (await response.json()) as {
      error?: string;
      code?: string;
      suggestedAction?: "signup";
      expiresInMinutes?: number;
      devOtp?: string;
      notice?: string;
    };

    if (!response.ok) {
      setError(result.error ?? "Failed to send login OTP.");
      setAuthActionPrompt(result.suggestedAction === "signup" ? "signup" : null);
      setLoading(false);
      return;
    }

    setLoginEmail(normalizedEmail);
    setLoginOtp("");
    setLoginOtpSent(true);
    setDevOtpHint(
      result.devOtp
        ? `${result.notice ?? "Development OTP"} Code: ${result.devOtp}`
        : "",
    );
    setNotice(
      result.devOtp
        ? `Development mode is active. Use the code below for ${normalizedEmail}.`
        : `We sent a login code to ${normalizedEmail}. Enter it below within ${result.expiresInMinutes ?? 10} minutes.`,
    );
    setAuthActionPrompt(null);
    setLoading(false);
  }

  async function handleVerifyLoginOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/verify-login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: loginOtp }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setError(result.error ?? "Failed to verify login OTP.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Login succeeded but session was not available. Please try again.");
      setLoading(false);
      return;
    }

    await ensureStudentAccess();
    const defaultPath = await resolvePostLoginPath(user.id);
    const redirectedFrom = searchParams.get("redirectedFrom");
    router.replace(
      redirectedFrom && redirectedFrom.startsWith("/")
        ? redirectedFrom
        : defaultPath,
    );
    router.refresh();
    setLoading(false);
  }

  async function handleResendLoginOtp() {
    if (!loginEmail) {
      setError("Enter your email address first.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/send-login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail }),
    });

    const result = (await response.json()) as {
      error?: string;
      expiresInMinutes?: number;
      devOtp?: string;
      notice?: string;
    };

    if (!response.ok) {
      setError(result.error ?? "Failed to resend login OTP.");
      setLoading(false);
      return;
    }

    setDevOtpHint(
      result.devOtp
        ? `${result.notice ?? "Development OTP"} Code: ${result.devOtp}`
        : "",
    );
    setNotice(
      result.devOtp
        ? `Development mode is active. Use the refreshed code below for ${loginEmail}.`
        : `A fresh login code was sent to ${loginEmail}. It expires in ${result.expiresInMinutes ?? 10} minutes.`,
    );
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const redirectTarget = new URL("/auth/callback", window.location.origin);
      const redirectedFrom = searchParams.get("redirectedFrom");

      if (redirectedFrom) {
        redirectTarget.searchParams.set("redirectedFrom", redirectedFrom);
      }

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTarget.toString(),
        },
      });

      if (oauthError) {
        throw oauthError;
      }

      if (!data.url) {
        throw new Error("Google sign-in could not be started.");
      }
    } catch (oauthError) {
      const message =
        oauthError && typeof oauthError === "object" && "message" in oauthError
          ? String((oauthError as { message: string }).message)
          : "Google sign-in failed. Please try again.";

      setError(message);
      setGoogleLoading(false);
    }
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

    const result = (await response.json()) as {
      error?: string;
      expiresInMinutes?: number;
      devOtp?: string;
      notice?: string;
    };

    if (!response.ok) {
      setError(result.error ?? "Failed to send signup OTP.");
      setLoading(false);
      return;
    }

    setPendingSignup(signupData);
    setSignupStep("otp");
    setOtp("");
    setDevOtpHint(
      result.devOtp
        ? `${result.notice ?? "Development OTP"} Code: ${result.devOtp}`
        : "",
    );
    setNotice(
      result.devOtp
        ? `Development mode is active. Use the code below to finish signup for ${signupData.email}.`
        : `We sent a verification code to ${signupData.email}. Enter it below within ${result.expiresInMinutes ?? 10} minutes.`,
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
      autoSignIn?: boolean;
    };

    if (!response.ok || !result.success) {
      setError(result.error ?? "Failed to verify OTP.");
      setLoading(false);
      return;
    }

    // The server performed sign-in and set session cookies.
    // If autoSignIn is explicitly false, the server could not sign in
    // automatically — ask the user to sign in manually.
    if (result.autoSignIn === false) {
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

    const result = (await response.json()) as {
      error?: string;
      expiresInMinutes?: number;
      devOtp?: string;
      notice?: string;
    };

    if (!response.ok) {
      setError(result.error ?? "Failed to resend signup OTP.");
      setLoading(false);
      return;
    }

    setDevOtpHint(
      result.devOtp
        ? `${result.notice ?? "Development OTP"} Code: ${result.devOtp}`
        : "",
    );
    setNotice(
      result.devOtp
        ? `Development mode is active. Use the refreshed code below for ${pendingSignup.email}.`
        : `A fresh verification code was sent to ${pendingSignup.email}. It expires in ${result.expiresInMinutes ?? 10} minutes.`,
    );
    setLoading(false);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setLoading(false);
    setAuthActionPrompt(null);

    if (nextMode === "signup") {
      setSignupStep("form");
      setOtp("");
      setDevOtpHint("");
      return;
    }

    setLoginMethod("password");
    setLoginOtp("");
    setLoginOtpSent(false);
    setDevOtpHint("");
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="md" />
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
            Academy Portal Access
          </p>
        </div>

        <div className="rounded-[28px] border border-black/6 bg-white p-7 shadow-[0_20px_90px_rgba(26,28,29,0.12)] backdrop-blur-xl">
          <div className="grid grid-cols-2 border-b border-black/6">
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

          {devOtpHint ? (
            <div className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {devOtpHint}
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {authActionPrompt === "signup" ? (
            <div className="mt-6 overflow-hidden rounded-[24px] border border-secondary/18 bg-linear-to-br from-[#fff9e6] via-white to-[#f7f8fb]">
              <div className="border-b border-secondary/12 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-secondary/75">
                  New To STC
                </p>
                <h3 className="mt-2 text-xl text-primary">Create your account to continue</h3>
              </div>
              <div className="space-y-4 px-5 py-5">
                <p className="text-sm leading-7 text-muted-foreground">
                  That email is not registered yet. Sign up first, then we can send your login
                  OTP and give you access to the portal.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={cn(stitchSecondaryButtonClass, "w-full justify-center py-3 text-sm")}
                >
                  Go To Sign Up
                </button>
              </div>
            </div>
          ) : null}

          {mode === "login" ? (
            <div className="mt-7 space-y-5">
              <div className="grid grid-cols-2 rounded-full border border-black/8 bg-muted/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("password");
                    setLoginOtp("");
                    setLoginOtpSent(false);
                    setError("");
                    setNotice("");
                  }}
                  className={cn(
                    "rounded-full px-4 py-3 text-sm font-medium transition",
                    loginMethod === "password"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("otp");
                    setError("");
                    setNotice("");
                  }}
                  className={cn(
                    "rounded-full px-4 py-3 text-sm font-medium transition",
                    loginMethod === "otp"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Email OTP
                </button>
              </div>

              {loginMethod === "password" ? (
                <form onSubmit={handlePasswordLogin} className="space-y-5">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-black/8 bg-white text-base font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loading || googleLoading}
                  >
                    {googleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleLogo className="h-5 w-5" />
                    )}
                    <span>Continue with Google</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-black/8" />
                    <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      or
                    </span>
                    <div className="h-px flex-1 bg-black/8" />
                  </div>

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
                    disabled={loading || googleLoading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>
              ) : !loginOtpSent ? (
                <form onSubmit={handleSendLoginOtp} className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm text-muted-foreground">Email Address</span>
                    <input
                      name="login_otp_email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="julian.voss@academy.edu"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
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
                      "Send Login OTP"
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyLoginOtp} className="space-y-5">
                  <OtpDeliveryPanel
                    eyebrow="OTP Login"
                    title="Check your email for the latest code"
                    email={loginEmail}
                    description="We sent a one-time sign-in code through our Resend mail flow. It is valid for a short window and refreshes each time you request a new code."
                    editLabel="Change email"
                    resendLabel="Resend OTP"
                    loading={loading}
                    onEdit={() => {
                      setLoginOtpSent(false);
                      setLoginOtp("");
                      setError("");
                      setNotice("");
                      setDevOtpHint("");
                    }}
                    onResend={handleResendLoginOtp}
                  />

                  <label className="block">
                    <span className="mb-2 block text-sm text-muted-foreground">6-digit OTP</span>
                    <input
                      name="login_otp"
                      value={loginOtp}
                      onChange={(event) =>
                        setLoginOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                      placeholder="123456"
                      className={cn(stitchInputClass, "text-center text-lg tracking-[0.35em]")}
                    />
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      Use the newest code from your inbox. If you requested another email, previous
                      codes will no longer verify.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className={cn(stitchButtonClass, "h-14 w-full text-base")}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Verify OTP and Sign In"
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : signupStep === "form" ? (
            <form onSubmit={handleSignup} className="mt-7 space-y-5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-black/8 bg-white text-base font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleLogo className="h-5 w-5" />
                )}
                <span>Sign Up with Google</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-black/8" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  or
                </span>
                <div className="h-px flex-1 bg-black/8" />
              </div>

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
              <OtpDeliveryPanel
                eyebrow="Pending Signup"
                title="Finish creating your account"
                email={pendingSignup?.email ?? ""}
                description="Your verification email has been queued through Resend. Open the latest message, copy the 6-digit code, and enter it below to activate the student portal."
                editLabel="Edit details"
                resendLabel="Resend OTP"
                loading={loading}
                onEdit={() => {
                  setSignupStep("form");
                  setOtp("");
                  setError("");
                  setNotice("");
                  setDevOtpHint("");
                }}
                onResend={handleResendOtp}
              />

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
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  The code in the most recent email is the one that will complete account creation.
                </span>
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
          <LoadingAnimation size="lg" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
