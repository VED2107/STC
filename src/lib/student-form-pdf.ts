/**
 * Student Registration Form PDF generator.
 *
 * Generates a professional PDF form for one or more students,
 * including their photo, personal details, academic info, fees,
 * and attendance summary – all on one page per student.
 *
 * Uses jsPDF (no server required – runs entirely in the browser).
 */

import jsPDF from "jspdf";
import { getFeesStatusLabel } from "@/lib/student-fees";
import type { StudentExportSource, StudentAttendanceSummary } from "@/lib/student-export";

// ─── Constants ──────────────────────────────────────────────────────

const PAGE_W = 210; // A4 width in mm
const PAGE_H = 297; // A4 height in mm
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLOR_PRIMARY: [number, number, number] = [22, 50, 65];
const COLOR_MUTED: [number, number, number] = [120, 130, 140];
const COLOR_ACCENT: [number, number, number] = [34, 139, 34];
const COLOR_BORDER: [number, number, number] = [220, 225, 230];
const COLOR_BG_HEADER: [number, number, number] = [245, 247, 250];

// ─── Image helpers ──────────────────────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── PDF drawing helpers ────────────────────────────────────────────

function drawHorizontalLine(doc: jsPDF, y: number) {
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

function drawLabelValue(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  maxWidth = 80,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(label, x, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_PRIMARY);
  const lines = doc.splitTextToSize(value || "N/A", maxWidth);
  doc.text(lines, x, y + 4.5);

  return y + 4.5 + lines.length * 4;
}

// ─── Main generator ─────────────────────────────────────────────────

export async function generateStudentFormPDF(
  students: StudentExportSource[],
  attendanceByStudentId: Record<string, StudentAttendanceSummary>,
  filename: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let i = 0; i < students.length; i++) {
    if (i > 0) doc.addPage();
    await renderStudentPage(doc, students[i], attendanceByStudentId, i);
  }

  doc.save(`${filename}.pdf`);
}

async function renderStudentPage(
  doc: jsPDF,
  student: StudentExportSource,
  attendanceByStudentId: Record<string, StudentAttendanceSummary>,
  index: number,
) {
  let y = MARGIN;

  // ── Header band ───────────────────────────────────────────────────
  doc.setFillColor(...COLOR_BG_HEADER);
  doc.rect(0, 0, PAGE_W, 42, "F");

  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, PAGE_W, 1.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("STC Academy", MARGIN, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Student Registration Form", MARGIN, 20);

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.setFontSize(8);
  doc.text(`Generated: ${dateStr}`, PAGE_W - MARGIN, 14, { align: "right" });
  doc.text(`Page ${index + 1}`, PAGE_W - MARGIN, 20, { align: "right" });

  drawHorizontalLine(doc, 42);
  y = 50;

  // ── Photo + Name section ──────────────────────────────────────────
  const photoUrl = student.profile?.avatar_url;
  const photoSize = 32;
  let photoEndX = MARGIN;

  if (photoUrl) {
    const imgData = await fetchImageAsBase64(photoUrl);
    if (imgData) {
      // Draw a subtle border around photo
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.4);
      doc.roundedRect(MARGIN - 0.5, y - 0.5, photoSize + 1, photoSize + 1, 2, 2, "S");
      doc.addImage(imgData, "JPEG", MARGIN, y, photoSize, photoSize);
      photoEndX = MARGIN + photoSize + 8;
    }
  }

  if (photoEndX === MARGIN) {
    // No photo – draw placeholder
    doc.setFillColor(235, 238, 241);
    doc.roundedRect(MARGIN, y, photoSize, photoSize, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text("No Photo", MARGIN + photoSize / 2, y + photoSize / 2 + 2, {
      align: "center",
    });
    photoEndX = MARGIN + photoSize + 8;
  }

  // Name beside photo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(student.profile?.full_name || "Unnamed Student", photoEndX, y + 10);

  // Student type badge
  const studentType =
    student.rowKind === "pending"
      ? "Pending Enrollment"
      : student.student_type === "tuition"
        ? "Tuition Student"
        : "Online Student";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_ACCENT);
  doc.text(studentType, photoEndX, y + 18);

  // Status
  const statusText =
    student.rowKind === "pending"
      ? "Pending Enrollment"
      : student.is_active
        ? "Active"
        : "Pending Review";
  doc.setTextColor(...COLOR_MUTED);
  doc.setFontSize(8);
  doc.text(`Status: ${statusText}`, photoEndX, y + 25);

  y += photoSize + 10;
  drawHorizontalLine(doc, y);
  y += 8;

  // ── Section: Personal Information ─────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Personal Information", MARGIN, y);
  y += 7;

  const colWidth = CONTENT_W / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth;

  const y1 = drawLabelValue(doc, leftX, y, "Full Name", student.profile?.full_name || "N/A", colWidth - 5);
  drawLabelValue(doc, rightX, y, "Phone", student.profile?.phone || "N/A", colWidth - 5);
  y = y1 + 4;

  const y2 = drawLabelValue(doc, leftX, y, "Email", student.profile?.email || "N/A", colWidth - 5);
  drawLabelValue(
    doc,
    rightX,
    y,
    "Student ID",
    student.rowKind === "enrolled" && student.enrollment_date
      ? `STC-${new Date(student.enrollment_date).getFullYear()}-${String(index + 1).padStart(3, "0")}`
      : "Pending",
    colWidth - 5,
  );
  y = y2 + 4;

  drawHorizontalLine(doc, y);
  y += 8;

  // ── Section: Academic Details ─────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Academic Details", MARGIN, y);
  y += 7;

  const y3 = drawLabelValue(doc, leftX, y, "Class", student.class?.name ?? "Awaiting assignment", colWidth - 5);
  drawLabelValue(doc, rightX, y, "Board", student.class?.board ?? "Pending", colWidth - 5);
  y = y3 + 4;

  const coursesText =
    student.rowKind === "pending"
      ? "No purchased course"
      : student.student_type === "online"
        ? (student.enrollments ?? [])
            .filter((e) => e.status === "active")
            .map((e) => e.course?.title)
            .filter(Boolean)
            .join(", ") || "No purchased course"
        : "Class resources";
  const y4 = drawLabelValue(doc, leftX, y, "Courses", coursesText, CONTENT_W);
  y = y4 + 4;

  const enrollmentDateStr = student.enrollment_date
    ? new Date(student.enrollment_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Pending";
  drawLabelValue(doc, leftX, y, "Enrollment Date", enrollmentDateStr, colWidth - 5);
  drawLabelValue(
    doc,
    rightX,
    y,
    "Access Type",
    student.rowKind === "pending"
      ? "Awaiting enrollment"
      : student.student_type === "tuition"
        ? "Tuition"
        : "Online",
    colWidth - 5,
  );
  y += 12;

  drawHorizontalLine(doc, y);
  y += 8;

  // ── Section: Fees Information ─────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Fees Information", MARGIN, y);
  y += 7;

  if (student.rowKind === "pending") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text("Fees will be applicable after class assignment and enrollment.", MARGIN, y);
    y += 8;
  } else {
    const feesStatus = getFeesStatusLabel(student);
    const y5 = drawLabelValue(
      doc,
      leftX,
      y,
      "Total Fees",
      `Rs ${(student.fees_amount ?? 0).toLocaleString("en-IN")}`,
      colWidth - 5,
    );
    drawLabelValue(doc, rightX, y, "Fees Status", feesStatus, colWidth - 5);
    y = y5 + 4;

    const y6 = drawLabelValue(
      doc,
      leftX,
      y,
      "Full Payment",
      student.fees_full_payment_paid ? "Paid" : "Not Paid",
      colWidth - 5,
    );
    drawLabelValue(
      doc,
      rightX,
      y,
      "Installment 1",
      student.fees_installment1_paid ? "Paid" : "Not Paid",
      colWidth - 5,
    );
    y = y6 + 4;

    drawLabelValue(doc, leftX, y, "Installment 2", student.fees_installment2_paid ? "Paid" : "Not Paid", colWidth - 5);
    y += 12;
  }

  drawHorizontalLine(doc, y);
  y += 8;

  // ── Section: Attendance Summary ───────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text("Attendance Summary", MARGIN, y);
  y += 7;

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

  const thirdCol = CONTENT_W / 3;
  drawLabelValue(doc, leftX, y, "Present", String(attendance.presentCount), thirdCol - 5);
  drawLabelValue(doc, leftX + thirdCol, y, "Absent", String(attendance.absentCount), thirdCol - 5);
  drawLabelValue(doc, leftX + thirdCol * 2, y, "Total Sessions", String(attendance.totalSessions), thirdCol - 5);
  y += 12;

  const lastDate = attendance.lastAttendanceDate
    ? new Date(attendance.lastAttendanceDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "No attendance recorded";
  drawLabelValue(doc, leftX, y, "Last Attendance Date", lastDate, CONTENT_W);
  y += 14;

  // ── Footer ────────────────────────────────────────────────────────
  drawHorizontalLine(doc, PAGE_H - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    "This document is auto-generated by STC Academy Management System. For official records, please refer to the administration office.",
    PAGE_W / 2,
    PAGE_H - 12,
    { align: "center" },
  );
}
