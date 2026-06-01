/**
 * Supabase Database type definitions for STC platform.
 *
 * This maps the actual Postgres schema into a TypeScript type that
 * the Supabase client uses for type-safe queries.  It replaces the
 * need for `supabase gen types` (which requires a running local
 * instance or linked project).
 *
 * If you add or change columns in migration.sql, update the
 * corresponding Row / Insert / Update shapes here.
 */

// ---------------------------------------------------------------------------
// Re-usable helpers
// ---------------------------------------------------------------------------
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------------------
// Row shapes  (what SELECT returns)
// Insert shapes (what INSERT accepts – omit generated defaults)
// Update shapes (what UPDATE accepts – all optional)
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  role: string;
  avatar_url: string | null;
  parent_phone: string | null;
  profile_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClassRow = {
  id: string;
  name: string;
  board: string;
  level: string;
  capacity: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TeacherRow = {
  id: string;
  profile_id: string | null;
  name: string;
  subject: string;
  bio: string | null;
  photo_url: string | null;
  qualification: string;
  created_at: string;
  updated_at: string;
};

type CourseRow = {
  id: string;
  title: string;
  description: string;
  class_id: string;
  subject: string;
  is_online_only: boolean;
  thumbnail_url: string | null;
  video_link: string | null;
  pdf_url: string | null;
  fee_inr: number;
  is_active: boolean;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
};

type StudentRow = {
  id: string;
  profile_id: string;
  class_id: string;
  branch_id: string | null;
  student_type: string;
  enrollment_date: string;
  is_active: boolean;
  fees_amount: number;
  fees_full_payment_paid: boolean;
  fees_installment1_paid: boolean;
  fees_installment2_paid: boolean;
  created_at: string;
  updated_at: string;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  status: string;
};

type AttendanceRow = {
  id: string;
  student_id: string;
  class_id: string;
  course_id: string | null;
  teacher_id: string | null;
  session_id: string | null;
  date: string;
  status: string;
  late_minutes: number | null;
  remarks: string | null;
  marked_by: string;
  check_in_at: string | null;
  check_out_at: string | null;
  scan_method: string;
  created_at: string;
};

type MaterialRow = {
  id: string;
  title: string;
  course_id: string | null;
  class_id: string;
  subject: string;
  type: string;
  file_url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SyllabusRow = {
  id: string;
  class_id: string;
  subject: string;
  content: Json;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  student_id: string;
  type: string;
  message: string;
  channel: string;
  delivery_type: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

type TeacherClassAccessRow = {
  id: string;
  teacher_profile_id: string;
  class_id: string;
  created_by: string | null;
  created_at: string;
};

type TeacherSubjectAccessRow = {
  id: string;
  teacher_profile_id: string;
  class_id: string;
  subject: string;
  created_by: string | null;
  created_at: string;
};

type QrTokenRow = {
  id: string;
  student_id: string;
  token: string;
  public_token: string | null;
  created_at: string;
};

type CoursePaymentRow = {
  id: string;
  student_id: string;
  course_id: string;
  gateway: string;
  currency: string;
  amount_inr: number;
  status: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  meta: Json;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

type BranchRow = {
  id: string;
  class_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type BranchSubjectRow = {
  id: string;
  branch_id: string;
  subject: string;
  created_at: string;
};

type AttendanceSessionRow = {
  id: string;
  class_id: string;
  course_id: string | null;
  subject: string;
  session_date: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
};

type GetAdminDashboardStatsFunction = {
  Args: Record<string, never>;
  Returns: {
    student_count: number;
    course_count: number;
    teacher_count: number;
    material_count: number;
    class_count: number;
    attendance_count: number;
    fees_paid: number;
    fees_partial: number;
    fees_not_paid: number;
  }[];
};

type MarkAttendanceFunction = {
  Args: {
    p_student_token: string;
    p_session_id: string;
    p_teacher_id: string;
  };
  Returns: {
    status: string;
    attendance_id: string;
    student_id: string;
    student_name: string;
    class_name: string;
    subject: string;
    session_date: string;
    check_in_at: string | null;
    check_out_at: string | null;
    message: string;
  }[];
};

// ---------------------------------------------------------------------------
// Table definition helper
// ---------------------------------------------------------------------------
type TableDef<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

// ---------------------------------------------------------------------------
// Main Database type
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, Partial<ProfileRow> & { id: string }, Partial<ProfileRow>>;
      classes: TableDef<ClassRow, Partial<ClassRow>, Partial<ClassRow>>;
      teachers: TableDef<TeacherRow, Partial<TeacherRow> & { name: string; subject: string }, Partial<TeacherRow>>;
      courses: TableDef<CourseRow, Partial<CourseRow> & { title: string; class_id: string; subject: string }, Partial<CourseRow>>;
      students: TableDef<StudentRow, Partial<StudentRow> & { profile_id: string; class_id: string }, Partial<StudentRow>>;
      enrollments: TableDef<EnrollmentRow, Partial<EnrollmentRow> & { student_id: string; course_id: string }, Partial<EnrollmentRow>>;
      attendance: TableDef<AttendanceRow, Partial<AttendanceRow> & { student_id: string; class_id: string; date: string; status: string; marked_by: string }, Partial<AttendanceRow>>;
      materials: TableDef<MaterialRow, Partial<MaterialRow> & { title: string; class_id: string; type: string; file_url: string }, Partial<MaterialRow>>;
      syllabus: TableDef<SyllabusRow, Partial<SyllabusRow> & { class_id: string; subject: string; content: Json; updated_by: string }, Partial<SyllabusRow>>;
      notifications: TableDef<NotificationRow, Partial<NotificationRow> & { student_id: string; type: string; message: string; channel: string }, Partial<NotificationRow>>;
      teacher_class_access: TableDef<TeacherClassAccessRow, Partial<TeacherClassAccessRow> & { teacher_profile_id: string; class_id: string }, Partial<TeacherClassAccessRow>>;
      teacher_subject_access: TableDef<TeacherSubjectAccessRow, Partial<TeacherSubjectAccessRow> & { teacher_profile_id: string; class_id: string; subject: string }, Partial<TeacherSubjectAccessRow>>;
      qr_tokens: TableDef<QrTokenRow, Partial<QrTokenRow> & { student_id: string }, Partial<QrTokenRow>>;
      course_payments: TableDef<CoursePaymentRow, Partial<CoursePaymentRow> & { student_id: string; course_id: string }, Partial<CoursePaymentRow>>;
      attendance_sessions: TableDef<AttendanceSessionRow, Partial<AttendanceSessionRow> & { class_id: string; session_date: string; created_by: string }, Partial<AttendanceSessionRow>>;
      branches: TableDef<BranchRow, Partial<BranchRow> & { class_id: string; name: string }, Partial<BranchRow>>;
      branch_subjects: TableDef<BranchSubjectRow, Partial<BranchSubjectRow> & { branch_id: string; subject: string }, Partial<BranchSubjectRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      get_admin_dashboard_stats: GetAdminDashboardStatsFunction;
      mark_attendance: MarkAttendanceFunction;
    };
  };
};
