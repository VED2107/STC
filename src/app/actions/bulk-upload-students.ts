"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PASSWORD = "STC@123";

export interface BulkStudentRow {
  full_name: string;
  email: string;
  phone: string;
  class_name: string;
  student_type: string;
  fees_amount: string;
  fees_installment1_paid: string;
  fees_installment2_paid: string;
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

function parseBool(val: string): boolean {
  const lower = (val ?? "").trim().toLowerCase();
  return ["yes", "true", "1", "paid"].includes(lower);
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

  // Pre-fetch all classes to map class_name → class_id
  const { data: allClasses } = await admin
    .from("classes")
    .select("id, name, board, level")
    .order("sort_order");

  const classMap = new Map<string, string>();
  for (const cls of (allClasses ?? []) as { id: string; name: string }[]) {
    classMap.set(cls.name.toLowerCase().trim(), cls.id);
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

  // Pre-fetch all existing student profile_ids to detect already-enrolled students
  const { data: existingStudentRows } = await admin
    .from("students")
    .select("profile_id");
  const enrolledProfileIds = new Set(
    ((existingStudentRows ?? []) as { profile_id: string }[]).map((s) => s.profile_id),
  );

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

    const className = (row.class_name ?? "").trim().toLowerCase();
    const classId = classMap.get(className);
    if (!classId) {
      results.push({
        row: rowNum,
        name,
        success: false,
        error: `Class "${row.class_name}" not found. Available: ${[...classMap.keys()].join(", ")}`,
      });
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

    const feesAmount = parseInt(row.fees_amount || "0", 10) || 0;
    const inst1Paid = parseBool(row.fees_installment1_paid);
    const inst2Paid = parseBool(row.fees_installment2_paid);

    try {
      // Check if user already exists by email (from pre-fetched map)
      let userId = email ? (authUserByEmail.get(email) ?? null) : null;

      // If user exists AND is already enrolled as a student, SKIP — don't overwrite
      if (userId && enrolledProfileIds.has(userId)) {
        results.push({
          row: rowNum,
          name,
          success: true,
          skipped: true,
          error: "Already enrolled — existing data preserved",
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
      }

      // Ensure profile exists with role = student
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

      // Create student record (we already checked they're not enrolled above)
      const { error: studentError } = await admin.from("students").insert({
        profile_id: userId,
        class_id: classId,
        student_type: studentType,
        enrollment_date: new Date().toISOString().split("T")[0],
        is_active: true,
        fees_amount: feesAmount,
        fees_installment1_paid: inst1Paid,
        fees_installment2_paid: inst2Paid,
      });

      if (studentError) {
        results.push({
          row: rowNum,
          name,
          success: false,
          error: `Student creation failed: ${studentError.message}`,
        });
        totalFailed++;
        continue;
      }

      // Track in our set so subsequent duplicate rows are caught
      enrolledProfileIds.add(userId);

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
