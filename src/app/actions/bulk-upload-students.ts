"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PASSWORD = "STC@123";

export interface BulkStudentRow {
  full_name: string;
  phone: string;
  email: string;
  student_type: string;
  photo_file?: string;
}

export interface BulkUploadResult {
  row: number;
  name: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  profileId?: string;
  photoFile?: string;
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

  const { data: existingUsersData } = await admin.auth.admin.listUsers();
  const allAuthUsers = existingUsersData?.users ?? [];
  const authUserByEmail = new Map<string, string>();
  for (const user of allAuthUsers) {
    if (user.email) {
      authUserByEmail.set(user.email.toLowerCase(), user.id);
    }
  }

  const { data: existingProfiles } = await admin
    .from("profiles")
    .select("id, phone, role");
  const profileByPhone = new Map<string, string>();
  const existingProfileIds = new Set<string>();
  for (const profile of (existingProfiles ?? []) as { id: string; phone: string; role: string }[]) {
    existingProfileIds.add(profile.id);
    if (profile.phone) {
      profileByPhone.set(profile.phone.trim(), profile.id);
    }
  }

  const results: BulkUploadResult[] = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNum = index + 1;
    const name = (row.full_name ?? "").trim();
    const photoFile = row.photo_file?.trim() || undefined;

    if (!name) {
      results.push({
        row: rowNum,
        name,
        success: false,
        error: "Full name is required",
        photoFile,
      });
      totalFailed++;
      continue;
    }

    const email = (row.email ?? "").trim().toLowerCase();
    const phone = (row.phone ?? "").trim();

    if (!email && !phone) {
      results.push({
        row: rowNum,
        name,
        success: false,
        error: "Email or phone is required",
        photoFile,
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
        photoFile,
      });
      totalFailed++;
      continue;
    }

    try {
      let userId = email ? (authUserByEmail.get(email) ?? null) : null;
      // Also check the generated phone email pattern for phone-only students
      if (!userId && phone) {
        userId = authUserByEmail.get(`${phone}@phone.stc.local`) ?? null;
      }
      if (!userId && phone) {
        userId = profileByPhone.get(phone) ?? null;
      }

      const matchedExistingAuthUser = Boolean(userId);

      if (userId && existingProfileIds.has(userId)) {
        results.push({
          row: rowNum,
          name,
          success: true,
          skipped: true,
          error: "Already registered - existing data preserved",
          profileId: userId,
          photoFile,
        });
        totalSkipped++;
        continue;
      }

      if (!userId) {
        // For phone-only students, generate a deterministic email so that
        // Supabase email+password login always works (avoids needing SMS auth).
        const effectiveEmail = email || (phone ? `${phone}@phone.stc.local` : "");

        const createPayload: {
          email: string;
          phone?: string;
          password: string;
          email_confirm: boolean;
          phone_confirm?: boolean;
          user_metadata: { full_name: string; phone: string };
        } = {
          email: effectiveEmail,
          email_confirm: true,
          password: DEFAULT_PASSWORD,
          user_metadata: { full_name: name, phone },
        };

        if (phone) {
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
            photoFile,
          });
          totalFailed++;
          continue;
        }

        userId = newUser.user.id;
        authUserByEmail.set(effectiveEmail, userId);
        if (phone) profileByPhone.set(phone, userId);
      } else if (matchedExistingAuthUser) {
        const effectiveEmail = email || (phone ? `${phone}@phone.stc.local` : "");

        const updatePayload: {
          email: string;
          phone?: string;
          password: string;
          email_confirm: boolean;
          phone_confirm?: boolean;
          user_metadata: { full_name: string; phone: string };
        } = {
          email: effectiveEmail,
          email_confirm: true,
          password: DEFAULT_PASSWORD,
          user_metadata: { full_name: name, phone },
        };

        if (phone) {
          updatePayload.phone = phone;
          updatePayload.phone_confirm = true;
        }

        const { error: updateError } = await admin.auth.admin.updateUserById(userId, updatePayload);
        if (updateError) {
          results.push({
            row: rowNum,
            name,
            success: false,
            error: `Auth update failed: ${updateError.message}`,
            photoFile,
          });
          totalFailed++;
          continue;
        }

        authUserByEmail.set(effectiveEmail, userId);
        if (phone) profileByPhone.set(phone, userId);
      }

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
          photoFile,
        });
        totalFailed++;
        continue;
      }

      existingProfileIds.add(userId);

      results.push({
        row: rowNum,
        name,
        success: true,
        profileId: userId,
        photoFile,
      });
      totalSuccess++;
    } catch (error) {
      results.push({
        row: rowNum,
        name,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        photoFile,
      });
      totalFailed++;
    }
  }

  return { results, totalSuccess, totalFailed, totalSkipped };
}
