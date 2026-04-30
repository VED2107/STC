import { getFeesStatusLabel } from "@/lib/student-fees";

export interface StudentAttendanceSummary {
  presentCount: number;
  absentCount: number;
  totalSessions: number;
  lastAttendanceDate: string | null;
}

export interface StudentExportSource {
  rowKind: "enrolled" | "pending";
  id: string;
  profile_id: string;
  enrollment_date: string | null;
  is_active: boolean;
  student_type: "tuition" | "online";
  fees_amount: number;
  fees_full_payment_paid: boolean;
  fees_installment1_paid: boolean;
  fees_installment2_paid: boolean;
  profile: {
    full_name: string;
    phone: string;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  class: {
    name: string;
    board?: string;
  } | null;
  enrollments?: Array<{ status: string; course: { title: string } | null }> | null;
}

export const studentExportHeaders = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "studentId", label: "Student ID" },
  { key: "className", label: "Class" },
  { key: "board", label: "Board" },
  { key: "accessType", label: "Access Type" },
  { key: "status", label: "Status" },
  { key: "courses", label: "Courses" },
  { key: "feesAmount", label: "Fees Amount (INR)" },
  { key: "feesFullPayment", label: "Full Payment Marked" },
  { key: "feesInstallment1", label: "Installment 1" },
  { key: "feesInstallment2", label: "Installment 2" },
  { key: "feesStatus", label: "Fees Status" },
  { key: "attendancePresentCount", label: "Attendance Present" },
  { key: "attendanceAbsentCount", label: "Attendance Absent" },
  { key: "attendanceTotalSessions", label: "Attendance Total" },
  { key: "lastAttendanceDate", label: "Last Attendance Date" },
  { key: "enrollmentDate", label: "Enrollment Date" },
];



export function buildStudentExportRows(
  students: StudentExportSource[],
  attendanceByStudentId: Record<string, StudentAttendanceSummary>,
) {
  return students.map((student, index) => {
    const attendance =
      student.rowKind === "enrolled"
        ? attendanceByStudentId[student.id] ?? {
            presentCount: 0,
            absentCount: 0,
            totalSessions: 0,
            lastAttendanceDate: null,
          }
        : {
            presentCount: 0,
            absentCount: 0,
            totalSessions: 0,
            lastAttendanceDate: null,
          };
    return {
      name: student.profile?.full_name || "Unnamed",
      phone: student.profile?.phone || "N/A",
      email: student.profile?.email || "N/A",
      studentId:
        student.rowKind === "enrolled" && student.enrollment_date
          ? `STC-${new Date(student.enrollment_date).getFullYear()}-${String(index + 1).padStart(3, "0")}`
          : "Pending",
      className: student.class?.name ?? "Awaiting assignment",
      board: student.class?.board ?? "Pending",
      accessType:
        student.rowKind === "pending"
          ? "Awaiting enrollment"
          : student.student_type === "tuition"
            ? "Tuition"
            : "Online",
      status:
        student.rowKind === "pending"
          ? "Pending Enrollment"
          : student.is_active
            ? "Active"
            : "Pending Review",
      courses:
        student.rowKind === "pending"
          ? "No purchased course"
          : student.student_type === "online"
            ? (student.enrollments ?? [])
                .filter((entry) => entry.status === "active")
                .map((entry) => entry.course?.title)
                .filter(Boolean)
                .join("; ") || "No purchased course"
            : "Class resources",
      feesAmount: student.rowKind === "pending" ? 0 : student.fees_amount ?? 0,
      feesFullPayment:
        student.rowKind === "pending"
          ? "No"
          : student.fees_full_payment_paid
            ? "Yes"
            : "No",
      feesInstallment1:
        student.rowKind === "pending"
          ? "Not Enrolled"
          : student.fees_installment1_paid
            ? "Paid"
            : "Not Paid",
      feesInstallment2:
        student.rowKind === "pending"
          ? "Not Enrolled"
          : student.fees_installment2_paid
            ? "Paid"
            : "Not Paid",
      feesStatus:
        student.rowKind === "pending" ? "Pending enrollment" : getFeesStatusLabel(student),
      attendancePresentCount: attendance.presentCount,
      attendanceAbsentCount: attendance.absentCount,
      attendanceTotalSessions: attendance.totalSessions,
      lastAttendanceDate: attendance.lastAttendanceDate
        ? new Date(attendance.lastAttendanceDate).toLocaleDateString("en-IN")
        : "No attendance yet",
      enrollmentDate: student.enrollment_date
        ? new Date(student.enrollment_date).toLocaleDateString("en-IN")
        : "Pending",
    };
  });
}
