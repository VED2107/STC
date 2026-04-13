import { createAdminClient } from "@/lib/supabase/admin";

export async function ensureOnlineStudentAccess(input: {
  userId: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const admin = createAdminClient();
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id, role, full_name, phone, email")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileLookupError) {
    throw new Error(profileLookupError.message);
  }

  if (existingProfile?.role && existingProfile.role !== "student") {
    return;
  }

  await admin.from("profiles").upsert({
    id: input.userId,
    full_name: existingProfile?.full_name || input.fullName?.trim() || "",
    phone: existingProfile?.phone || input.phone?.trim() || "",
    email: existingProfile?.email || input.email?.trim() || null,
    role: "student",
  });
}
