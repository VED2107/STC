/**
 * Client-side CSV & Excel export utilities.
 *
 * CSV  – plain comma-separated text (universally compatible).
 * XLSX – lightweight XML-based SpreadsheetML package (no dependencies).
 */

// ─── CSV ────────────────────────────────────────────────────────────

function escapeCSV(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(
  rows: Record<string, unknown>[],
  headers: { key: string; label: string }[],
  filename: string,
) {
  const headerLine = headers.map((h) => escapeCSV(h.label)).join(",");
  const bodyLines = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h.key])).join(","),
  );
  const csv = [headerLine, ...bodyLines].join("\r\n");
  triggerDownload(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}

// ─── XLSX (SpreadsheetML) ───────────────────────────────────────────

/**
 * Generates a minimal .xlsx file using Open XML SpreadsheetML
 * and the built‑in browser Compression Streams API (available in
 * all modern browsers). Falls back to an uncompressed blob if
 * Compression Streams is unavailable.
 */
export async function downloadXLSX(
  rows: Record<string, unknown>[],
  headers: { key: string; label: string }[],
  filename: string,
) {
  // Build XML strings for the workbook
  const sheetData = buildSheetDataXml(rows, headers);
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${sheetData}</sheetData>
</worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
  Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml"
  ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml"
  ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
  Target="xl/workbook.xml"/>
</Relationships>`;

  // Build ZIP using the lightweight manual zip builder
  const zipBlob = await buildZip([
    { path: "[Content_Types].xml", content: contentTypesXml },
    { path: "_rels/.rels", content: relsXml },
    { path: "xl/workbook.xml", content: workbookXml },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { path: "xl/worksheets/sheet1.xml", content: sheetXml },
  ]);

  triggerDownload(
    zipBlob,
    `${filename}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function buildSheetDataXml(
  rows: Record<string, unknown>[],
  headers: { key: string; label: string }[],
): string {
  const xmlEscape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Header row
  let xml = "<row>";
  for (const h of headers) {
    xml += `<c t="inlineStr"><is><t>${xmlEscape(h.label)}</t></is></c>`;
  }
  xml += "</row>";

  // Data rows
  for (const row of rows) {
    xml += "<row>";
    for (const h of headers) {
      const raw = row[h.key];
      const value = String(raw ?? "");
      const isNum = raw !== null && raw !== undefined && raw !== "" && !isNaN(Number(value));
      if (isNum) {
        xml += `<c><v>${value}</v></c>`;
      } else {
        xml += `<c t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
      }
    }
    xml += "</row>";
  }
  return xml;
}

// ─── Minimal ZIP builder (no dependencies) ──────────────────────────

interface ZipEntry {
  path: string;
  content: string;
}

async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const parts: { data: Uint8Array; path: Uint8Array; crc: number }[] = [];

  for (const entry of entries) {
    const data = encoder.encode(entry.content);
    const path = encoder.encode(entry.path);
    parts.push({ data, path, crc: crc32(data) });
  }

  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const { data, path, crc } of parts) {
    // Local file header
    const localHeader = new Uint8Array(30 + path.length);
    const lview = new DataView(localHeader.buffer);
    lview.setUint32(0, 0x04034b50, true); // signature
    lview.setUint16(4, 20, true);          // version needed
    lview.setUint16(6, 0, true);           // flags
    lview.setUint16(8, 0, true);           // compression: stored
    lview.setUint16(10, 0, true);          // mod time
    lview.setUint16(12, 0, true);          // mod date
    lview.setUint32(14, crc, true);
    lview.setUint32(18, data.length, true); // compressed size
    lview.setUint32(22, data.length, true); // uncompressed size
    lview.setUint16(26, path.length, true);
    lview.setUint16(28, 0, true);           // extra length
    localHeader.set(path, 30);

    chunks.push(localHeader, data);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + path.length);
    const dv = new DataView(cdEntry.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, data.length, true);
    dv.setUint32(24, data.length, true);
    dv.setUint16(28, path.length, true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(38, 0x20, true);  // external attrs
    dv.setUint32(42, offset, true); // local header offset
    cdEntry.set(path, 46);

    centralDirectory.push(cdEntry);
    offset += localHeader.length + data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDirectory) {
    chunks.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, parts.length, true);
  ev.setUint16(10, parts.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  ev.setUint16(20, 0, true);
  chunks.push(eocd);

  return new Blob(chunks as unknown as BlobPart[], { type: "application/zip" });
}

// CRC-32 (IEEE)
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Trigger browser download ───────────────────────────────────────

function triggerDownload(
  content: string | Blob,
  filename: string,
  mimeType: string,
) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── CSV Parser (client-side) ───────────────────────────────────────

export function parseCSVText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── XLSX Parser (lightweight, client-side) ─────────────────────────

export async function parseXLSXFromFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const entries = await readZipEntries(new Uint8Array(buffer));

  const sheetEntry = entries.find((e) => e.path.toLowerCase().includes("sheet1.xml") || e.path.toLowerCase().includes("sheet.xml"));
  if (!sheetEntry) return [];

  const decoder = new TextDecoder();
  const sheetXml = decoder.decode(sheetEntry.data);

  // Try shared strings first
  const sstEntry = entries.find((e) => e.path.toLowerCase().includes("sharedstrings.xml"));
  const sharedStrings: string[] = [];
  if (sstEntry) {
    const sstXml = decoder.decode(sstEntry.data);
    const siMatches = sstXml.matchAll(/<si[^>]*>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/si>/gi);
    for (const match of siMatches) {
      sharedStrings.push(decodeXmlEntities(match[1]));
    }
  }

  // Parse rows
  const rowMatches = sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/gi);
  const allRows: string[][] = [];

  for (const rowMatch of rowMatches) {
    const cellMatches = rowMatch[1].matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/gi);
    const cells: string[] = [];

    for (const cellMatch of cellMatches) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const isSharedString = /t\s*=\s*"s"/i.test(attrs);
      const valueMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      const inlineMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);

      if (inlineMatch) {
        cells.push(decodeXmlEntities(inlineMatch[1]));
      } else if (valueMatch) {
        if (isSharedString) {
          const idx = parseInt(valueMatch[1], 10);
          cells.push(sharedStrings[idx] ?? "");
        } else {
          cells.push(valueMatch[1]);
        }
      } else {
        cells.push("");
      }
    }
    allRows.push(cells);
  }

  if (allRows.length < 2) return [];

  const headers = allRows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const result: Record<string, string>[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const row: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      const val = (allRows[i][index] ?? "").trim();
      row[header] = val;
      if (val) hasValue = true;
    });
    if (hasValue) result.push(row);
  }

  return result;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function readZipEntries(data: Uint8Array): Promise<{ path: string; data: Uint8Array }[]> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const entries: { path: string; data: Uint8Array }[] = [];
  const decoder = new TextDecoder();

  let offset = 0;
  while (offset < data.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const compMethod = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const path = decoder.decode(data.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;

    if (compMethod === 0) {
      entries.push({ path, data: data.subarray(dataStart, dataStart + compSize) });
    }
    offset = dataStart + compSize;
  }

  return entries;
}

// ─── Bulk Upload Template ──────────────────────────────────────────

const BULK_TEMPLATE_HEADERS = [
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "class_name", label: "Class Name" },
  { key: "student_type", label: "Student Type" },
  { key: "fees_amount", label: "Fees Amount (INR)" },
  { key: "fees_installment1_paid", label: "Installment 1 Paid" },
  { key: "fees_installment2_paid", label: "Installment 2 Paid" },
];

const SAMPLE_ROW = {
  full_name: "John Doe",
  email: "johndoe@example.com",
  phone: "9876543210",
  class_name: "Class 5 - GSEB",
  student_type: "tuition",
  fees_amount: "5000",
  fees_installment1_paid: "no",
  fees_installment2_paid: "no",
};

export function downloadBulkTemplateCSV() {
  downloadCSV([SAMPLE_ROW], BULK_TEMPLATE_HEADERS, "student_registration_template");
}

export async function downloadBulkTemplateXLSX() {
  await downloadXLSX([SAMPLE_ROW], BULK_TEMPLATE_HEADERS, "student_registration_template");
}

