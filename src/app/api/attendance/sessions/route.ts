import { NextRequest, NextResponse } from "next/server";
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

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function serializeSession(row: SessionRow) {
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
}

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "teacher" && profile.role !== "admin" && profile.role !== "super_admin")) {
    return {
      error: NextResponse.json(
        { error: "Only teachers and admins can manage attendance sessions" },
        { status: 403 },
      ),
    };
  }

  return { user, role: profile.role as "teacher" | "admin" | "super_admin" };
}

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export async function GET() {
  const actor = await getActor();
  if ("error" in actor) return actor.error;

  const admin = createAdminClient();
  const today = todayInIndia();

  let sessionQuery = admin
    .from("attendance_sessions")
    .select(
      "id, class_id, course_id, subject, session_date, is_active, class:classes(name), course:courses(title, subject)",
    )
    .eq("session_date", today)
    .eq("is_active", true)
    .order("starts_at", { ascending: true });

  if (actor.role === "teacher") {
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
      return NextResponse.json({ error: accessError?.message ?? subjectAccessError?.message ?? "Unable to load teacher access" }, { status: 500 });
    }

    const classIds = ((accessRows as { class_id: string }[] | null) ?? []).map(
      (row) => row.class_id,
    );

    if (classIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    sessionQuery = sessionQuery.in("class_id", classIds);

    const allowedSubjectKeys = new Set(
      ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
        buildTeacherSubjectAccessKey(row.class_id, row.subject),
      ),
    );

    const { data, error } = await sessionQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: (((data as unknown as SessionRow[] | null) ?? []).filter((row) =>
        allowedSubjectKeys.has(buildTeacherSubjectAccessKey(row.class_id, row.subject)),
      )).map((row) => serializeSession(row)),
    });
  }

  const { data, error } = await sessionQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((data as unknown as SessionRow[] | null) ?? []).map((row) =>
      serializeSession(row),
    ),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getActor();
  if ("error" in actor) return actor.error;

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
    return NextResponse.json({ error: "Missing classId" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (actor.role === "teacher") {
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
        { status: 403 },
      );
    }

    if (!courseId && !requestedSubject) {
      return NextResponse.json(
        { error: "Teachers must select an assigned subject" },
        { status: 403 },
      );
    }

    const allowedSubjectKeys = new Set(
      ((subjectAccessRows as Array<{ class_id: string; subject: string }> | null) ?? []).map((row) =>
        buildTeacherSubjectAccessKey(row.class_id, row.subject),
      ),
    );

    const allowedSubject =
      courseId
        ? await (async () => {
            const { data: teacherCourse, error: teacherCourseError } = await admin
              .from("courses")
              .select("id, class_id, subject, title")
              .eq("id", courseId)
              .single();

            if (teacherCourseError || !teacherCourse) {
              return { error: NextResponse.json({ error: "Course not found" }, { status: 404 }) };
            }

            return { subject: (teacherCourse as { subject: string }).subject };
          })()
        : { subject: requestedSubject };

    if ("error" in allowedSubject) {
      return allowedSubject.error;
    }

    if (!allowedSubjectKeys.has(buildTeacherSubjectAccessKey(classId, allowedSubject.subject))) {
      return NextResponse.json(
        { error: "You do not have access to this subject for the selected class" },
        { status: 403 },
      );
    }
  }

  let subject = requestedSubject || "General Attendance";

  if (courseId) {
    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("id, class_id, subject, title")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if ((course as { class_id: string }).class_id !== classId) {
      return NextResponse.json(
        { error: "Selected course does not belong to the selected class" },
        { status: 400 },
      );
    }

    subject = ((course as { subject?: string | null }).subject ?? "").trim() || subject;
  }

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
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    if (!(existing as { is_active: boolean }).is_active) {
      const { error: updateError } = await admin
        .from("attendance_sessions")
        .update({ is_active: true, ends_at: null })
        .eq("id", (existing as { id: string }).id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      session: serializeSession(existing as unknown as SessionRow),
    });
  }

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
      { status: 500 },
    );
  }

  return NextResponse.json({
    session: serializeSession(created as unknown as SessionRow),
  });
}
