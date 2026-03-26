"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";

interface CreateStudentInput {
  fullName: string;
  email: string;
  phone: string;
  classId: string;
  studentType: "tuition" | "online";
}

interface CreateStudentResult {
  success: boolean;
  error?: string;
}

/**
 * Server action: creates a student auth user via the admin API
 * so the calling admin's session is never affected.
 */
export async function createStudent(
  input: CreateStudentInput
): Promise<CreateStudentResult> {
  const { fullName, email, phone, classId, studentType } = input;

  if (!classId) {
    return {
      success: false,
      error: "Class is required to create a student.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      error: "Server misconfigured — missing SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create auth user via admin API (does NOT touch calling session)
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password: "Student@123",
      email_confirm: true, // auto-confirm so student can log in immediately
      user_metadata: { full_name: fullName, phone },
    });

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? "Failed to create auth user" };
  }

  // 2. Create profile row
  const { error: profileError } = await admin.from("profiles").upsert({
    id: authData.user.id,
    full_name: fullName,
    phone,
    role: "student",
  });

  if (profileError) {
    return { success: false, error: "User created but profile insert failed: " + profileError.message };
  }

  // 3. Create student row
  const { error: studentError } = await admin.from("students").insert({
    profile_id: authData.user.id,
    class_id: classId,
    student_type: studentType,
    enrollment_date: new Date().toISOString().split("T")[0],
    is_active: true,
  });

  if (studentError) {
    return { success: false, error: "Profile created but student insert failed: " + studentError.message };
  }

  return { success: true };
}
