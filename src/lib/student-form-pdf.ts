import jsPDF from "jspdf";
import type { StudentExportSource } from "@/lib/student-export";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const FORM_X = MARGIN;
const FORM_Y = 14;
const FORM_W = PAGE_W - MARGIN * 2;
const FORM_H = PAGE_H - MARGIN * 2;

const COLOR_BG: [number, number, number] = [249, 249, 251];
const COLOR_WHITE: [number, number, number] = [255, 255, 255];
const COLOR_PRIMARY: [number, number, number] = [3, 3, 4];
const COLOR_ACCENT: [number, number, number] = [115, 92, 0];
const COLOR_TEXT: [number, number, number] = [26, 28, 29];
const COLOR_MUTED: [number, number, number] = [70, 70, 74];
const COLOR_BORDER: [number, number, number] = [217, 218, 220];
const COLOR_SOFT: [number, number, number] = [243, 243, 245];

type ClassSubjectsByClassId = Record<string, string[]>;

type StudentFormSource = StudentExportSource & {
  class_id?: string | null;
};

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

function addContainedImage(doc: jsPDF, imageData: string, x: number, y: number, width: number, height: number) {
  const props = doc.getImageProperties(imageData);
  const imageWidth = props.width || width;
  const imageHeight = props.height || height;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const renderWidth = imageWidth * scale;
  const renderHeight = imageHeight * scale;
  const offsetX = x + (width - renderWidth) / 2;
  const offsetY = y + (height - renderHeight) / 2;
  doc.addImage(imageData, "JPEG", offsetX, offsetY, renderWidth, renderHeight);
}

function drawFormShell(doc: jsPDF) {
  doc.setFillColor(...COLOR_BG);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(...COLOR_WHITE);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.8);
  doc.rect(FORM_X, FORM_Y, FORM_W, FORM_H, "FD");
}

function drawCell(doc: jsPDF, x: number, y: number, width: number, height: number, fill?: [number, number, number]) {
  if (fill) {
    doc.setFillColor(...fill);
    doc.setDrawColor(...COLOR_BORDER);
    doc.rect(x, y, width, height, "FD");
    return;
  }

  doc.setDrawColor(...COLOR_BORDER);
  doc.rect(x, y, width, height);
}

function drawCellLabel(doc: jsPDF, x: number, y: number, text: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(text.toUpperCase(), x, y);
}

function drawCellValue(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  text: string,
  opts?: { size?: number; align?: "left" | "center" | "right" },
) {
  const size = opts?.size ?? 9.5;
  const align = opts?.align ?? "left";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...COLOR_TEXT);
  const lines = doc.splitTextToSize(text || "N/A", width);
  if (align === "left") {
    doc.text(lines, x, y);
  } else {
    doc.text(lines, x, y, { align });
  }
  return lines.length;
}

function drawFieldRow(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
) {
  drawCell(doc, x, y, width, height);
  drawCellLabel(doc, x + 3, y + 5.5, label);
  drawCellValue(doc, x + 3, y + 12, width - 6, value);
}

function drawHeaderTitle(doc: jsPDF) {
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(FORM_X, FORM_Y, FORM_W, 14, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("STC ACADEMY", FORM_X + 4, FORM_Y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.text("OFFICIAL STUDENT RECORD", FORM_X + FORM_W - 4, FORM_Y + 9, { align: "right" });

  doc.setDrawColor(...COLOR_ACCENT);
  doc.setLineWidth(0.9);
  doc.line(FORM_X + 4, FORM_Y + 21, FORM_X + FORM_W - 4, FORM_Y + 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLOR_ACCENT);
  doc.text("OFFICIAL ADMISSION FORM", PAGE_W / 2, FORM_Y + 28, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Student registration and verification document", PAGE_W / 2, FORM_Y + 33, {
    align: "center",
  });
}

function drawPhotoBox(doc: jsPDF, x: number, y: number, width: number, height: number) {
  drawCell(doc, x, y, width, height, COLOR_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_ACCENT);
  doc.text("PHOTO", x + width / 2, y + 6, { align: "center" });
}

function drawSignatureLine(doc: jsPDF, x: number, y: number, width: number, label: string) {
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.4);
  doc.line(x, y, x + width, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(label, x + width / 2, y + 4, { align: "center" });
}

function getStudentStatus(student: StudentExportSource) {
  if (student.rowKind === "pending") return "Pending Enrollment";
  return student.is_active ? "Active Student" : "Pending Review";
}

function getStudentType(student: StudentExportSource) {
  if (student.rowKind === "pending") return "Admission Pending";
  return student.student_type === "tuition" ? "Tuition Program" : "Online Program";
}

function getStudentId(student: StudentExportSource, pageIndex: number) {
  if (student.rowKind !== "enrolled" || !student.enrollment_date) {
    return "Pending";
  }

  return `STC-${new Date(student.enrollment_date).getFullYear()}-${String(pageIndex + 1).padStart(3, "0")}`;
}

function getAccessType(student: StudentExportSource) {
  if (student.rowKind === "pending") return "Awaiting enrollment";
  return student.student_type === "tuition" ? "Tuition" : "Online";
}

function getEnrollmentDate(student: StudentExportSource) {
  return student.enrollment_date
    ? new Date(student.enrollment_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Pending";
}

function getClassSubjects(student: StudentFormSource, classSubjectsByClassId: ClassSubjectsByClassId) {
  if (student.rowKind === "pending" || !student.class_id) {
    return "Awaiting class assignment";
  }

  const subjects = classSubjectsByClassId[student.class_id] ?? [];
  return subjects.length > 0 ? subjects.join(", ") : "No subjects assigned";
}

export async function generateStudentFormPDF(
  students: StudentExportSource[],
  classSubjectsByClassId: ClassSubjectsByClassId,
  filename: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let i = 0; i < students.length; i++) {
    if (i > 0) doc.addPage();
    await renderStudentPage(doc, students[i] as StudentFormSource, classSubjectsByClassId, i);
  }

  doc.save(`${filename}.pdf`);
}

async function renderStudentPage(
  doc: jsPDF,
  student: StudentFormSource,
  classSubjectsByClassId: ClassSubjectsByClassId,
  pageIndex: number,
) {
  drawFormShell(doc);
  drawHeaderTitle(doc);

  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const tableX = FORM_X + 4;
  const tableW = FORM_W - 8;
  let y = FORM_Y + 38;

  const leftW = 106;
  const rightW = tableW - leftW;
  drawFieldRow(doc, tableX, y, leftW, 16, "Student Name", student.profile?.full_name || "N/A");
  drawPhotoBox(doc, tableX + leftW, y, rightW, 40);

  if (student.profile?.avatar_url) {
    const imageData = await fetchImageAsBase64(student.profile.avatar_url);
    if (imageData) {
      addContainedImage(doc, imageData, tableX + leftW + 3, y + 8, rightW - 6, 29);
    }
  } else {
    drawCellValue(doc, tableX + leftW + rightW / 2, y + 22, rightW - 8, "Student Photo", {
      size: 8,
      align: "center",
    });
  }

  y += 16;
  drawFieldRow(doc, tableX, y, leftW, 16, "Mobile Number", student.profile?.phone || "N/A");
  y += 16;
  drawFieldRow(doc, tableX, y, leftW, 16, "Email Address", student.profile?.email || "N/A");

  y += 16;
  const halfW = tableW / 2;
  drawFieldRow(doc, tableX, y, halfW, 16, "Student ID", getStudentId(student, pageIndex));
  drawFieldRow(doc, tableX + halfW, y, halfW, 16, "Profile Status", getStudentStatus(student));

  y += 16;
  drawFieldRow(doc, tableX, y, halfW, 16, "Class", student.class?.name ?? "Awaiting assignment");
  drawFieldRow(doc, tableX + halfW, y, halfW, 16, "Board", student.class?.board ?? "Pending");

  y += 16;
  drawFieldRow(doc, tableX, y, halfW, 16, "Access Type", getAccessType(student));
  drawFieldRow(doc, tableX + halfW, y, halfW, 16, "Program Type", getStudentType(student));

  y += 16;
  drawFieldRow(doc, tableX, y, tableW, 18, "Enrollment Date", getEnrollmentDate(student));

  y += 18;
  const subjectsText = getClassSubjects(student, classSubjectsByClassId);
  const subjectsLines = doc.splitTextToSize(subjectsText, tableW - 6);
  const subjectsHeight = Math.max(24, 10 + subjectsLines.length * 4.5);
  drawCell(doc, tableX, y, tableW, subjectsHeight);
  drawCellLabel(doc, tableX + 3, y + 5.5, "Subjects of Class");
  drawCellValue(doc, tableX + 3, y + 12, tableW - 6, subjectsText);

  y += subjectsHeight + 8;
  drawCell(doc, tableX, y, tableW, 28);
  drawCellLabel(doc, tableX + 3, y + 5.5, "Academy Information");
  drawCellValue(
    doc,
    tableX + 3,
    y + 12,
    tableW - 6,
    "This admission form is issued by STC Academy for student record management, class reference, and parent-side verification.",
    { size: 8.5 },
  );

  y += 38;
  drawCell(doc, tableX, y, tableW, 24);
  drawCellLabel(doc, tableX + 3, y + 5.5, "Declaration");
  drawCellValue(
    doc,
    tableX + 3,
    y + 12,
    tableW - 6,
    "I confirm that the above information is correct to the best of my knowledge and acceptable for academy records.",
    { size: 8.5 },
  );

  const signatureY = FORM_Y + FORM_H - 28;
  drawSignatureLine(doc, FORM_X + 20, signatureY, 54, "Authorized By STC Academy");
  drawSignatureLine(doc, PAGE_W - FORM_X - 74, signatureY, 54, "Parent Signature");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Generated on ${generatedOn}  |  Page ${pageIndex + 1}`, PAGE_W / 2, FORM_Y + FORM_H - 8, {
    align: "center",
  });
}
