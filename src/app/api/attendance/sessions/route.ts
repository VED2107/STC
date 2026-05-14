import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTeacherSubjectAccessKey } from "@/lib/teacher-subject-access";

interface SessionRow {
  id: string;
  class_id: string;
  course_id: string | null;
  subject: string;
  session_date: string;
  is_active: boolean;
  class: { name: string } | { name: string }[] | null;
  course:
    | { title: string; subject: string }
    | { title: string; subject: string }[]
    | null;
}

// Moved to module scope for better performance
const unwrapRelation = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const serializeSession = (row: SessionRow) => {
  const classRow = unwrapRelation(row.class);
  const courseRow = unwrapRelation(row.course);

  return {
    id: row.id,
    classId: row.class_id,
    courseId: row.course_id,
    subject: row.subject,
    sessionDate: row.session_date,
    isActive: row.is_active,
    className: classRow?.name ?? "Unknown class",
    courseTitle: courseRow?.title ?? null,
  };
};

// Cache today's date calculation for the request lifecycle
const todayInIndia = (): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
};

const getActor = async () => {
  const supabase = await createClient();

  // Early auth validation
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  // Optimized profile query with error handling
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { error: "Profile not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const allowedRoles = new Set(["teacher", "admin", "super_admin"]);
  if (!allowedRoles.has(profile.role)) {
    return {
      error: NextResponse.json(
        { error: "Only teachers and admins can manage attendance sessions" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  return { user, role: profile.role as "teacher" | "admin" | "super_admin" };
};

export async function GET() {
  const actor = await getActor();
  if ("error" in actor) return actor.error;

  // Single admin client instance
  const admin = createAdminClient();
  const today = todayInIndia();

  try {
    // Base session query with optimized joins
    let sessionQuery = admin
      .from("attendance_sessions")
      .select(
        "id, class_id, course_id, subject, session_date, is_active, class:classes(name), course:courses(title, subject)",
      )
      .eq("session_date", today)
      .eq("is_active", true)
      .order("starts_at", { ascending: true });

    if (actor.role === "teacher") {
      // Parallel access queries for teachers
      const [{ data: accessRows, error: accessError }, { data: subjectAccessRows, error: subjectAccessError }] = await Promise.all([
        admin
          .from("teacher_class_access")
          .select("class_id")
          .eq("teacher_profile_id", actor.user.id),
        admin
          .from("teacher_subject_access")
          .select("class_id, subject")
          .eq("teacher_profile_id", actor.user.id),
      ]);

      if (accessError || subjectAccessError) {
        return NextResponse.json(
          { error: accessError?.message ?? subjectAccessError?.message ?? "Unable to load teacher access" },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map(
        (row) => row.class_id,
      );

      if (classIds.length === 0) {
        return NextResponse.json(
          { data: [] },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      // Filter sessions by class access
      sessionQuery = sessionQuery.in("class_id", classIds);

      // Build subject access lookup for efficient filtering
      const allowedSubjectKeys = new Set(
        ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
          buildTeacherSubjectAccessKey(row.class_id, row.subject),
        ),
      );

      const { data, error } = await sessionQuery;
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      // Filter and serialize in one pass
      const filteredData = ((data as unknown as SessionRow[] | null) ?? [])
        .filter((row) =>
          allowedSubjectKeys.has(buildTeacherSubjectAccessKey(row.class_id, row.subject))
        )
        .map((row) => serializeSession(row));

      return NextResponse.json(
        { data: filteredData },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Admin/super_admin path - no filtering needed
    const { data, error } = await sessionQuery;
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        data: ((data as unknown as SessionRow[] | null) ?? []).map((row) =>
          serializeSession(row),
        ),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sessions" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor();
  if ("error" in actor) return actor.error;

  try {
    // Input validation with early returns
    const body = (await request.json()) as {
      classId?: string;
      courseId?: string | null;
      subject?: string | null;
      date?: string;
    };

    const classId = body.classId?.trim();
    const courseId = body.courseId?.trim() || null;
    const requestedSubject = body.subject?.trim() || "";
    const sessionDate = body.date?.trim() || todayInIndia();

    if (!classId) {
      return NextResponse.json(
        { error: "Missing classId" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Single admin client instance
    const admin = createAdminClient();

    if (actor.role === "teacher") {
      // Validate teacher access with parallel queries
      const [{ data: access }, { data: subjectAccessRows }] = await Promise.all([
        admin
          .from("teacher_class_access")
          .select("class_id")
          .eq("teacher_profile_id", actor.user.id)
          .eq("class_id", classId)
          .maybeSingle(),
        admin
          .from("teacher_subject_access")
          .select("class_id, subject")
          .eq("teacher_profile_id", actor.user.id)
          .eq("class_id", classId),
      ]);

      if (!access) {
        return NextResponse.json(
          { error: "You do not have access to this class" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (!courseId && !requestedSubject) {
        return NextResponse.json(
          { error: "Teachers must select an assigned subject" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }

      // Build subject access lookup
      const allowedSubjectKeys = new Set(
        ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
          buildTeacherSubjectAccessKey(row.class_id, row.subject),
        ),
      );

      // Validate subject access
      let allowedSubject: { subject: string } | { error: NextResponse };

      if (courseId) {
        const { data: teacherCourse, error: teacherCourseError } = await admin
          .from("courses")
          .select("id, class_id, subject, title")
          .eq("id", courseId)
          .single();

        if (teacherCourseError || !teacherCourse) {
          allowedSubject = {
            error: NextResponse.json(
              { error: "Course not found" },
              { status: 404, headers: { "Cache-Control": "no-store" } }
            )
          };
        } else {
          allowedSubject = { subject: (teacherCourse as { subject: string }).subject };
        }
      } else {
        allowedSubject = { subject: requestedSubject };
      }

      if ("error" in allowedSubject) {
        return allowedSubject.error;
      }

      if (!allowedSubjectKeys.has(buildTeacherSubjectAccessKey(classId, allowedSubject.subject))) {
        return NextResponse.json(
          { error: "You do not have access to this subject for the selected class" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Determine subject for the session
    let subject = requestedSubject || "General Attendance";

    if (courseId) {
      const { data: course, error: courseError } = await admin
        .from("courses")
        .select("id, class_id, subject, title")
        .eq("id", courseId)
        .single();

      if (courseError || !course) {
        return NextResponse.json(
          { error: "Course not found" },
          { status: 404, headers: { "Cache-Control": "no-store" } }
        );
      }

      if ((course as { class_id: string }).class_id !== classId) {
        return NextResponse.json(
          { error: "Selected course does not belong to the selected class" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      subject = ((course as { subject?: string | null }).subject ?? "").trim() || subject;
    }

    // Build optimized existing session query
    let existingQuery = admin
      .from("attendance_sessions")
      .select(
        "id, class_id, course_id, subject, session_date, is_active, class:classes(name), course:courses(title, subject)",
      )
      .eq("class_id", classId)
      .eq("session_date", sessionDate);

    existingQuery = courseId
      ? existingQuery.eq("course_id", courseId)
      : requestedSubject
        ? existingQuery.is("course_id", null).eq("subject", requestedSubject)
        : existingQuery.is("course_id", null);

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Handle existing session
    if (existing) {
      if (!(existing as { is_active: boolean }).is_active) {
        const { error: updateError } = await admin
          .from("attendance_sessions")
          .update({ is_active: true, ends_at: null })
          .eq("id", (existing as { id: string }).id);

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500, headers: { "Cache-Control": "no-store" } }
          );
        }
      }

      return NextResponse.json(
        { session: serializeSession(existing as unknown as SessionRow) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Create new session
    const { data: created, error: createError } = await admin
      .from("attendance_sessions")
      .insert({
        class_id: classId,
        course_id: courseId,
        subject,
        session_date: sessionDate,
        is_active: sessionDate === todayInIndia(),
        created_by: actor.user.id,
      })
      .select(
        "id, class_id, course_id, subject, session_date, is_active, class:classes(name), course:courses(title, subject)",
      )
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create attendance session" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { session: serializeSession(created as unknown as SessionRow) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
