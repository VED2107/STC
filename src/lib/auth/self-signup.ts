import { createClient as createAdminClient } from "@supabase/supabase-js";

function createAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server misconfigured for self-signup provisioning.");
  }

  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveDefaultClassId(admin: ReturnType<typeof createAdmin>) {
  const configuredClassId = process.env.SELF_SIGNUP_DEFAULT_CLASS_ID?.trim();

  if (configuredClassId) {
    return configuredClassId;
  }

  const { data: fallbackClass, error } = await admin
    .from("classes")
    .select("id")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !fallbackClass?.id) {
    throw new Error("No class is available for self-signup students.");
  }

  return fallbackClass.id;
}

export async function ensureOnlineStudentAccess(input: {
  userId: string;
  fullName?: string | null;
  phone?: string | null;
}) {
  const admin = createAdmin();
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id, role, full_name, phone")
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
    role: "student",
  });

  const { data: existingStudent, error: studentLookupError } = await admin
    .from("students")
    .select("id")
    .eq("profile_id", input.userId)
    .maybeSingle();

  if (studentLookupError) {
    throw new Error(studentLookupError.message);
  }

  if (existingStudent?.id) {
    return;
  }

  const defaultClassId = await resolveDefaultClassId(admin);

  const { error: insertError } = await admin.from("students").insert({
    profile_id: input.userId,
    class_id: defaultClassId,
    student_type: "online",
    enrollment_date: new Date().toISOString().split("T")[0],
    is_active: true,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}
