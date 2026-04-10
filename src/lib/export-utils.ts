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
