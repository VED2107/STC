import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/qr-tokens
 *
 * Fetch all QR tokens with student details.
 * Optionally filter by class_id query param.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const classId = request.nextUrl.searchParams.get("class_id");
  const admin = createAdminClient();

  // Get all active students with their tokens
  let studentQuery = admin
    .from("students")
    .select("id, class_id, profile:profiles(full_name), class:classes(name)")
    .eq("is_active", true)
    .order("id");

  if (classId) {
    studentQuery = studentQuery.eq("class_id", classId);
  }

  const { data: students, error: studentsError } = await studentQuery;

  if (studentsError) {
    return NextResponse.json(
      { error: studentsError.message },
      { status: 500 },
    );
  }

  // Get all existing tokens
  const { data: tokens } = await admin.from("qr_tokens").select("student_id, token, created_at");

  const tokenMap = new Map(
    ((tokens as Array<{ student_id: string; token: string; created_at: string }>) ?? []).map(
      (t) => [t.student_id, { token: t.token, created_at: t.created_at }],
    ),
  );

  const result = ((students as unknown as Array<{
    id: string;
    class_id: string;
    profile: { full_name: string } | null;
    class: { name: string } | null;
  }>) ?? []).map((s) => {
    const entry = tokenMap.get(s.id);
    return {
      student_id: s.id,
      student_name: s.profile?.full_name ?? "Unknown",
      class_id: s.class_id,
      class_name: s.class?.name ?? "N/A",
      token: entry?.token ?? null,
      token_created_at: entry?.created_at ?? null,
    };
  });

  return NextResponse.json({ data: result });
}

/**
 * POST /api/admin/qr-tokens
 *
 * Generate or regenerate a QR token for a student.
 * Body: { student_id: string }
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await request.json()) as { student_id?: string };
  const studentId = body.student_id?.trim();

  if (!studentId) {
    return NextResponse.json(
      { error: "Missing student_id" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Verify student exists
  const { data: student } = await admin
    .from("students")
    .select("id")
    .eq("id", studentId)
    .single();

  if (!student) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: 404 },
    );
  }

  // Delete existing token if any, then insert a new one
  await admin.from("qr_tokens").delete().eq("student_id", studentId);

  const { data: newToken, error: insertError } = await admin
    .from("qr_tokens")
    .insert({ student_id: studentId })
    .select("token, created_at")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    student_id: studentId,
    token: (newToken as { token: string; created_at: string }).token,
    created_at: (newToken as { token: string; created_at: string }).created_at,
  });
}

/**
 * PUT /api/admin/qr-tokens
 *
 * Bulk generate tokens for all students in a class.
 * Body: { class_id: string }
 * Admin only.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await request.json()) as { class_id?: string };
  const classId = body.class_id?.trim();

  if (!classId) {
    return NextResponse.json(
      { error: "Missing class_id" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Get all active students in the class who don't have tokens yet
  const { data: students } = await admin
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("is_active", true);

  if (!students || students.length === 0) {
    return NextResponse.json({ generated: 0 });
  }

  const { data: existingTokens } = await admin
    .from("qr_tokens")
    .select("student_id")
    .in(
      "student_id",
      (students as Array<{ id: string }>).map((s) => s.id),
    );

  const existingSet = new Set(
    ((existingTokens as Array<{ student_id: string }>) ?? []).map(
      (t) => t.student_id,
    ),
  );

  const toInsert = (students as Array<{ id: string }>)
    .filter((s) => !existingSet.has(s.id))
    .map((s) => ({ student_id: s.id }));

  if (toInsert.length === 0) {
    return NextResponse.json({ generated: 0, message: "All students already have tokens" });
  }

  const { error: bulkError } = await admin.from("qr_tokens").insert(toInsert);

  if (bulkError) {
    return NextResponse.json({ error: bulkError.message }, { status: 500 });
  }

  return NextResponse.json({ generated: toInsert.length });
}
