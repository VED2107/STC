"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PASSWORD = "STC@123";

export interface BulkStudentRow {
  full_name: string;
  phone: string;
  email: string;
  student_type: string;
}

export interface BulkUploadResult {
  row: number;
  name: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
}

export interface BulkUploadResponse {
  results: BulkUploadResult[];
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
}

export async function bulkUploadStudents(
  rows: BulkStudentRow[],
): Promise<BulkUploadResponse> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      results: [{ row: 0, name: "", success: false, error: "Server misconfigured" }],
      totalSuccess: 0,
      totalFailed: rows.length,
      totalSkipped: 0,
    };
  }

  // Pre-fetch all existing auth users ONCE (not per row) for email matching
  const { data: existingUsersData } = await admin.auth.admin.listUsers();
  const allAuthUsers = existingUsersData?.users ?? [];
  const authUserByEmail = new Map<string, string>();
  for (const u of allAuthUsers) {
    if (u.email) {
      authUserByEmail.set(u.email.toLowerCase(), u.id);
    }
  }

  // Pre-fetch all existing profiles to detect duplicates by phone or existing profiles
  const { data: existingProfiles } = await admin
    .from("profiles")
    .select("id, phone, role");
  const profileByPhone = new Map<string, string>();
  const existingProfileIds = new Set<string>();
  for (const p of (existingProfiles ?? []) as { id: string; phone: string; role: string }[]) {
    existingProfileIds.add(p.id);
    if (p.phone) {
      profileByPhone.set(p.phone.trim(), p.id);
    }
  }

  const results: BulkUploadResult[] = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const name = (row.full_name ?? "").trim();

    // Validate required fields
    if (!name) {
      results.push({ row: rowNum, name, success: false, error: "Full name is required" });
      totalFailed++;
      continue;
    }

    const email = (row.email ?? "").trim().toLowerCase();
    const phone = (row.phone ?? "").trim();

    if (!email && !phone) {
      results.push({ row: rowNum, name, success: false, error: "Email or phone is required" });
      totalFailed++;
      continue;
    }

    const studentType = (row.student_type ?? "tuition").trim().toLowerCase();
    if (!["tuition", "online"].includes(studentType)) {
      results.push({
        row: rowNum,
        name,
        success: false,
        error: `Invalid student type "${row.student_type}". Use "tuition" or "online"`,
      });
      totalFailed++;
      continue;
    }

    try {
      // Check if user already exists by email (from pre-fetched map)
      let userId = email ? (authUserByEmail.get(email) ?? null) : null;

      // Also check by phone if no email match
      if (!userId && phone) {
        userId = profileByPhone.get(phone) ?? null;
      }

      // If user already has a profile, SKIP — they already exist in the system
      if (userId && existingProfileIds.has(userId)) {
        results.push({
          row: rowNum,
          name,
          success: true,
          skipped: true,
          error: "Already registered — existing data preserved",
        });
        totalSkipped++;
        continue;
      }

      // Create auth user if not found
      if (!userId) {
        const createPayload: {
          email?: string;
          phone?: string;
          password: string;
          email_confirm?: boolean;
          phone_confirm?: boolean;
          user_metadata: { full_name: string; phone: string };
        } = {
          password: DEFAULT_PASSWORD,
          user_metadata: { full_name: name, phone },
        };

        if (email) {
          createPayload.email = email;
          createPayload.email_confirm = true;
        }
        if (phone && !email) {
          createPayload.phone = phone;
          createPayload.phone_confirm = true;
        }

        const { data: newUser, error: createError } = await admin.auth.admin.createUser(createPayload);

        if (createError) {
          results.push({
            row: rowNum,
            name,
            success: false,
            error: `Auth creation failed: ${createError.message}`,
          });
          totalFailed++;
          continue;
        }

        userId = newUser.user.id;
        // Add to our maps so subsequent duplicate rows in the same CSV are caught
        if (email) authUserByEmail.set(email, userId);
        if (phone) profileByPhone.set(phone, userId);
      }

      // Ensure profile exists with role = student
      // The handle_new_user trigger already creates a profile on auth user creation,
      // but we upsert to make sure the data is correct
      const { error: profileError } = await admin
        .from("profiles")
        .upsert(
          {
            id: userId,
            full_name: name,
            phone,
            email: email || null,
            role: "student",
          },
          { onConflict: "id" },
        );

      if (profileError) {
        results.push({
          row: rowNum,
          name,
          success: false,
          error: `Profile creation failed: ${profileError.message}`,
        });
        totalFailed++;
        continue;
      }

      // Track in our set so subsequent duplicate rows are caught
      existingProfileIds.add(userId);

      // Student record is NOT created here because class_id is NOT NULL in the DB.
      // The admin can assign class + enroll via the student form dialog later.
      // These students will appear as "Pending Enrollment" in the admin panel.

      results.push({ row: rowNum, name, success: true });
      totalSuccess++;
    } catch (err) {
      results.push({
        row: rowNum,
        name,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      totalFailed++;
    }
  }

  return { results, totalSuccess, totalFailed, totalSkipped };
}
