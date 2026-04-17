/** Shared TypeScript types for the STC platform */

export type UserRole = "student" | "teacher" | "admin";
export type AttendanceStatus = "present" | "absent";
export type MaterialType = "pdf" | "notes" | "video";
export type NotificationChannel = "whatsapp" | "sms";
export type NotificationStatus = "sent" | "failed" | "pending";
export type BoardType = "GSEB" | "NCERT";
export type ClassLevel = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "SSC" | "HSC";
export type StudentType = "tuition" | "online";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  avatar_url: string | null;
  parent_phone: string | null;
  profile_reviewed_at: string | null;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  board: BoardType;
  level: ClassLevel;
  capacity: number;
  sort_order: number;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  class_id: string;
  subject: string;
  thumbnail_url: string | null;
  video_link?: string | null;
  pdf_url?: string | null;
  fee_inr?: number;
  is_active: boolean;
  teacher_id: string | null;
  created_at: string;
  /** Joined data */
  class?: Class;
  teacher?: Teacher;
}

export interface Teacher {
  id: string;
  profile_id: string | null;
  name: string;
  subject: string;
  bio: string | null;
  photo_url: string | null;
  qualification: string;
  created_at: string;
}

export interface TeacherClassAccess {
  id: string;
  teacher_profile_id: string;
  class_id: string;
  created_by: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  profile_id: string;
  class_id: string;
  student_type: StudentType;
  enrollment_date: string;
  is_active: boolean;
  fees_amount: number;
  fees_installment1_paid: boolean;
  fees_installment2_paid: boolean;
  created_at: string;
  /** Joined data */
  profile?: Profile;
  class?: Class;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  status: "active" | "completed" | "dropped";
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  course_id: string | null;
  session_id: string | null;
  date: string;
  status: AttendanceStatus;
  late_minutes: number | null;
  remarks: string | null;
  marked_by: string;
  check_in_at: string | null;
  check_out_at: string | null;
  scan_method: 'manual' | 'qr';
  created_at: string;
  /** Joined data */
  student?: Student;
  course?: Course | null;
}

export interface Material {
  id: string;
  title: string;
  course_id: string;
  class_id: string;
  subject: string;
  type: MaterialType;
  file_url: string;
  sort_order: number;
  created_at: string;
}

export interface Syllabus {
  id: string;
  class_id: string;
  subject: string;
  content: Record<string, unknown>;
  updated_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  student_id: string;
  type: "absence" | "general" | "checkout";
  message: string;
  channel: NotificationChannel;
  delivery_type: NotificationChannel;
  status: NotificationStatus;
  sent_at: string | null;
  created_at: string;
}

export interface QrToken {
  id: string;
  student_id: string;
  token: string;
  public_token?: string;
  created_at: string;
  /** Joined data */
  student?: Student;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  course_id: string | null;
  subject: string;
  session_date: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  student?: Student;
  class?: Class;
  course?: Course | null;
}
