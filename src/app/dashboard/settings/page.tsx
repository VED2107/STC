"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Loader2, UserCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  StitchSectionHeader,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchButtonClass,
  stitchInputClass,
} from "@/components/stitch/primitives";

interface StudentSettingsData {
  email: string;
  fullName: string;
  phone: string;
  parentPhone: string | null;
  role: string;
  notifications: number;
  studentType: "tuition" | "online" | null;
}

function StudentSettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentSettingsData | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", parentPhone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isTuitionStudent = data?.studentType === "tuition";

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const [{ data: profile }, { data: student }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, parent_phone, role")
        .eq("id", user.id)
        .single(),
      supabase
        .from("students")
        .select("id, student_type")
        .eq("profile_id", user.id)
        .single(),
    ]);

    let notificationsCount = 0;

    if (student?.id) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student.id);
      notificationsCount = count ?? 0;
    }

    setData({
      email: user.email ?? "",
      fullName: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      parentPhone: profile?.parent_phone ?? null,
      role: profile?.role ?? "student",
      notifications: notificationsCount ?? 0,
      studentType: (student?.student_type as "tuition" | "online" | undefined) ?? null,
    });

    setForm({
      fullName: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      parentPhone: profile?.parent_phone ?? "",
    });

    await refreshProfile();
    if (!options?.silent) setLoading(false);
  }, [refreshProfile, router, supabase]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: form.fullName.trim(),
        phone: isTuitionStudent ? (data?.phone ?? form.phone.trim()) : form.phone.trim(),
        parent_phone: form.parentPhone.trim() ? form.parentPhone.trim() : null,
        profile_reviewed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess("Saved changes.");
    await refreshProfile();
    await fetchData({ silent: true });
    setSaving(false);
  }, [data?.phone, fetchData, form.fullName, form.parentPhone, form.phone, isTuitionStudent, refreshProfile, router, supabase]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Account Settings"
        title="Profile Settings"
        description={
          searchParams.get("onboarding") === "1"
            ? "Complete your profile once before continuing. Your saved details will be visible to admin and teachers."
            : "Review your registered account information, contact details, and current notification status."
        }
      />

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={stitchPanelClass}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={stitchPanelSoftClass}>
              <p className="stitch-kicker">Full Name</p>
              <input
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                className={`mt-4 ${stitchInputClass}`}
                placeholder="Your name"
              />
            </div>
            <div className={stitchPanelSoftClass}>
              <p className="stitch-kicker">Email</p>
              <p className="mt-4 wrap-break-word text-xl text-foreground">{data?.email || "Not set"}</p>
            </div>
            <div className={stitchPanelSoftClass}>
              <p className="stitch-kicker">Phone</p>
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className={`mt-4 ${stitchInputClass}`}
                placeholder="Your phone"
                readOnly={isTuitionStudent}
                disabled={isTuitionStudent}
              />
              {isTuitionStudent ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Tuition student phone numbers are locked. Ask the admin to update this number.
                </p>
              ) : null}
            </div>
            <div className={stitchPanelSoftClass}>
              <p className="stitch-kicker">Parent Phone</p>
              <input
                value={form.parentPhone}
                onChange={(event) => setForm((prev) => ({ ...prev, parentPhone: event.target.value }))}
                className={`mt-4 ${stitchInputClass}`}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
              className={stitchButtonClass}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          <div className={stitchPanelClass}>
            <UserCircle2 className="h-6 w-6 text-primary" />
            <h3 className="mt-6 text-3xl text-foreground">Role</h3>
            <p className="mt-4 text-sm uppercase tracking-[0.22em] text-muted-foreground">
              {data?.role ?? "student"}
            </p>
          </div>
          <div className={stitchPanelClass}>
            <Bell className="h-6 w-6 text-primary" />
            <h3 className="mt-6 text-3xl text-foreground">Notifications</h3>
            <p className="mt-4 font-heading text-5xl text-foreground">
              {data?.notifications ?? 0}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Notification history is generated from your student record and attendance alerts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <StudentSettingsPageInner />
    </Suspense>
  );
}
