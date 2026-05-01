export interface TeacherSubjectAccessRow {
  teacher_profile_id?: string;
  class_id: string;
  subject: string;
}

export function normalizeTeacherSubject(subject: string | null | undefined) {
  return (subject ?? "").trim().toLowerCase();
}

export function buildTeacherSubjectAccessKey(classId: string, subject: string) {
  return `${classId}::${normalizeTeacherSubject(subject)}`;
}
