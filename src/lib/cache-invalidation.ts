import { invalidateCache } from "./dashboard-cache";

export function invalidateStudentDashboardCaches() {
  invalidateCache("student:dashboard:");
  invalidateCache("student:materials:");
  invalidateCache("student:syllabus:");
  invalidateCache("student:attendance:");
  invalidateCache("student:class:");
}

export function invalidateAdminDashboardCaches() {
  invalidateCache("admin:teachers");
  invalidateCache("admin:courses");
  invalidateCache("admin:classes");
  invalidateCache("admin:students:");
  invalidateCache("admin:syllabus:");
  invalidateCache("admin:materials:");
  invalidateCache("admin:attendance:");
  invalidateCache("admin:qr:");
}

export function invalidateAfterAttendanceSave() {
  invalidateCache("student:attendance:");
  invalidateCache("student:dashboard:");
  invalidateCache("admin:attendance:session:");
}

export function invalidateAfterMaterialsMutation() {
  invalidateCache("admin:materials:");
  invalidateCache("student:materials:");
  invalidateCache("student:syllabus:");
  invalidateCache("student:dashboard:");
}

export function invalidateAfterSyllabusMutation() {
  invalidateCache("admin:syllabus:");
  invalidateCache("admin:materials:data:");
  invalidateCache("admin:attendance:base:");
  invalidateCache("student:syllabus:");
  invalidateCache("student:dashboard:");
}

export function invalidateAfterClassMutation() {
  invalidateCache("admin:classes");
  invalidateCache("admin:attendance:base:");
  invalidateCache("admin:materials:");
  invalidateCache("admin:syllabus:");
  invalidateCache("admin:qr:");
  invalidateStudentDashboardCaches();
}

export function invalidateAfterStudentMutation() {
  invalidateCache("admin:students:");
  invalidateCache("admin:attendance:");
  invalidateCache("admin:qr:");
}

export function invalidateAfterTeacherMutation() {
  invalidateCache("admin:teachers");
  invalidateCache("admin:attendance:base:teacher:");
  invalidateCache("admin:syllabus:teacher:");
  invalidateCache("admin:materials:data:teacher:");
  invalidateCache("admin:students:teacher:");
}

export function invalidateAfterCourseMutation() {
  invalidateCache("admin:courses");
  invalidateCache("admin:attendance:base:");
  invalidateCache("admin:materials:data:");
  invalidateCache("student:dashboard:");
}
