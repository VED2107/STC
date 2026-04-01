"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { StudentType } from "@/lib/types/database";

interface CreateStudentInput {
  profileId: string;
  classId: string;
  studentType: StudentType;
  isActive: boolean;
}

interface CreateStudentResult {
  success: boolean;
  error?: string;
}

export interface AvailableStudentProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
}

export async function getAvailableStudentProfiles(): Promise<AvailableStudentProfile[]> {
  try {
    const admin = createAdminClient();

  const [{ data: profilesData, error: profilesError }, { data: studentsData, error: studentsError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, phone")
        .eq("role", "student")
        .order("full_name"),
      admin.from("students").select("profile_id"),
    ]);

  if (profilesError || studentsError) {
    return [];
  }

  const {
    data: { users },
    error: usersError,
  } = await admin.auth.admin.listUsers();

  if (usersError) {
    return [];
  }

  const enrolledProfileIds = new Set(
    ((studentsData as Array<{ profile_id: string }> | null) ?? []).map((student) => student.profile_id),
  );

  const emailByUserId = new Map(
    (users ?? []).map((user) => [user.id, user.email ?? ""]),
  );

  const normalizedProfiles = (((profilesData as AvailableStudentProfile[] | null) ?? []).map(
    (profile) => ({
      ...profile,
      email: emailByUserId.get(profile.id) ?? "",
    }),
  ));

  return normalizedProfiles.filter((profile) => !enrolledProfileIds.has(profile.id));
  } catch {
    return [];
  }
}

export async function createStudent(
  input: CreateStudentInput
): Promise<CreateStudentResult> {
  const { profileId, classId, studentType, isActive } = input;

  if (!profileId) {
    return {
      success: false,
      error: "Select a signed-up student profile first.",
    };
  }

  if (!classId) {
    return {
      success: false,
      error: "Class is required to enroll a student.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      error: "Server misconfigured - missing SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: profileError?.message ?? "Student profile not found.",
    };
  }

  if (profile.role !== "student") {
    return {
      success: false,
      error: "Only student profiles can be enrolled.",
    };
  }

  const { data: existingStudent, error: existingStudentError } = await admin
    .from("students")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existingStudentError) {
    return {
      success: false,
      error: existingStudentError.message,
    };
  }

  if (existingStudent) {
    return {
      success: false,
      error: "This student profile is already enrolled.",
    };
  }

  const { error: studentError } = await admin.from("students").insert({
    profile_id: profileId,
    class_id: classId,
    student_type: studentType,
    enrollment_date: new Date().toISOString().split("T")[0],
    is_active: isActive,
  });

  if (studentError) {
    return {
      success: false,
      error: studentError.message,
    };
  }

  return { success: true };
}
