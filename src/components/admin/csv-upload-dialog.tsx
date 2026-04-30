"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileImage, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import {
  bulkUploadStudents,
  type BulkStudentRow,
  type BulkUploadResponse,
  type BulkUploadResult,
} from "@/app/actions/bulk-upload-students";
import { uploadStudentPhotoAdmin } from "@/app/actions/upload-student-photo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadBulkTemplateCSV,
  downloadBulkTemplateXLSX,
  parseCSVText,
  parseXLSXFromFile,
} from "@/lib/export-utils";

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PhotoUploadOutcome {
  uploaded: number;
  missing: number;
  failed: Array<{ row: number; name: string; error: string }>;
}



function normalizePhotoKey(fileName: string) {
  return fileName.trim().toLowerCase();
}

export function CsvUploadDialog({ open, onOpenChange, onSuccess }: CsvUploadDialogProps) {
  const [parsedRows, setParsedRows] = useState<BulkStudentRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResponse | null>(null);
  const [parseError, setParseError] = useState("");
  const [photoOutcome, setPhotoOutcome] = useState<PhotoUploadOutcome | null>(null);

  const photoRefsInSheet = useMemo(
    () =>
      parsedRows
        .map((row) => row.photo_file?.trim())
        .filter((value): value is string => Boolean(value)),
    [parsedRows],
  );

  const matchedPhotoCount = useMemo(() => {
    const selected = new Set(photoFiles.map((file) => normalizePhotoKey(file.name)));
    return photoRefsInSheet.filter((name) => selected.has(normalizePhotoKey(name))).length;
  }, [photoFiles, photoRefsInSheet]);

  const unmatchedPhotoRefs = useMemo(() => {
    const selected = new Set(photoFiles.map((file) => normalizePhotoKey(file.name)));
    return photoRefsInSheet.filter((name) => !selected.has(normalizePhotoKey(name)));
  }, [photoFiles, photoRefsInSheet]);

  const resetState = useCallback(() => {
    setParsedRows([]);
    setFileName("");
    setPhotoFiles([]);
    setUploading(false);
    setResult(null);
    setParseError("");
    setPhotoOutcome(null);
  }, []);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError("");
    setResult(null);
    setPhotoOutcome(null);
    setFileName(file.name);

    try {
      let rows: Record<string, string>[];

      if (file.name.endsWith(".csv")) {
        rows = parseCSVText(await file.text());
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        rows = await parseXLSXFromFile(file);
      } else {
        setParseError("Unsupported file format. Please upload a .csv or .xlsx file.");
        return;
      }

      if (rows.length === 0) {
        setParseError("No data rows found in the file. Please check the format.");
        return;
      }

      const normalized = rows.map((row) => ({
        full_name: row["full_name"] || row["name"] || row["fullname"] || row["student_name"] || "",
        phone: row["phone"] || row["mobile"] || row["phone_number"] || row["number"] || row["contact"] || "",
        email: row["email"] || row["e-mail"] || row["email_address"] || "",
        student_type: row["student_type"] || row["type"] || row["student-type"] || "tuition",
        photo_file:
          row["photo_file"] || row["photo"] || row["photo_name"] || row["image"] || row["image_file"] || "",
      }));

      setParsedRows(normalized);
    } catch (error) {
      setParseError(`Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    event.target.value = "";
  }

  function handlePhotoFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPhotoFiles(files);
    setResult(null);
    setPhotoOutcome(null);
    event.target.value = "";
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function processPhotoUploads(results: BulkUploadResult[]): Promise<PhotoUploadOutcome> {
    const filesByName = new Map(photoFiles.map((file) => [normalizePhotoKey(file.name), file]));
    const outcome: PhotoUploadOutcome = { uploaded: 0, missing: 0, failed: [] };

    for (const item of results) {
      if (!item.success || !item.profileId || !item.photoFile) {
        continue;
      }

      const matchedFile = filesByName.get(normalizePhotoKey(item.photoFile));
      if (!matchedFile) {
        outcome.missing++;
        continue;
      }

      try {
        const base64 = await fileToBase64(matchedFile);
        const result = await uploadStudentPhotoAdmin({
          profileId: item.profileId,
          fileName: matchedFile.name,
          fileBase64: base64,
          contentType: matchedFile.type || "image/jpeg",
        });

        if (!result.success) {
          outcome.failed.push({
            row: item.row,
            name: item.name || item.profileId,
            error: result.error || "Photo upload failed",
          });
        } else {
          outcome.uploaded++;
        }
      } catch (error) {
        outcome.failed.push({
          row: item.row,
          name: item.name || item.profileId,
          error: error instanceof Error ? error.message : "Photo upload failed",
        });
      }
    }

    return outcome;
  }

  async function handleUpload() {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setResult(null);
    setPhotoOutcome(null);

    try {
      const response = await bulkUploadStudents(parsedRows);
      setResult(response);

      const nextPhotoOutcome = await processPhotoUploads(response.results);
      setPhotoOutcome(nextPhotoOutcome);

      if (response.totalSuccess > 0 || response.totalSkipped > 0 || nextPhotoOutcome.uploaded > 0) {
        onSuccess();
      }
    } catch (error) {
      setResult({
        results: [{
          row: 0,
          name: "",
          success: false,
          error: error instanceof Error ? error.message : "Upload failed",
        }],
        totalSuccess: 0,
        totalFailed: parsedRows.length,
        totalSkipped: 0,
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Student Registration
          </DialogTitle>
          <DialogDescription>
            Download the template, fill student details, and optionally add a `photo_file` value for each student. Use the exact same image file names in the photo picker below.
            Default password for all registered students: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">STC@123</code>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">Step 1: Download Template</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Required columns are <strong>Full Name, Phone, Email, Student Type</strong>. Optional photo matching uses <strong>photo_file</strong>, such as <code>rahul.jpg</code>.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadBulkTemplateCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              CSV Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => void downloadBulkTemplateXLSX()} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Excel Template
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">Step 2: Upload Filled Sheet</p>
          <label
            htmlFor="csv-upload-input"
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            {fileName ? "Change File" : "Select File"}
            <input
              id="csv-upload-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => void handleFileChange(event)}
              className="hidden"
            />
          </label>
          {fileName ? (
            <div className="mt-2 flex items-center justify-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{fileName}</span>
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setFileName("");
                  setResult(null);
                  setPhotoOutcome(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">Step 3: Optional Student Photos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select all student image files at once. Each sheet row uses the `photo_file` column to match its image by file name.
          </p>
          <label
            htmlFor="student-photo-input"
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:bg-muted"
          >
            <FileImage className="h-4 w-4" />
            {photoFiles.length > 0 ? "Replace Photos" : "Select Photos"}
            <input
              id="student-photo-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoFilesChange}
              className="hidden"
            />
          </label>
          {photoFiles.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {photoFiles.length} photo file{photoFiles.length !== 1 ? "s" : ""} selected
            </p>
          ) : null}
          {photoRefsInSheet.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {matchedPhotoCount} of {photoRefsInSheet.length} referenced photo file{photoRefsInSheet.length !== 1 ? "s" : ""} matched
            </p>
          ) : null}
          {unmatchedPhotoRefs.length > 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              Missing selected files for: {unmatchedPhotoRefs.slice(0, 5).join(", ")}
              {unmatchedPhotoRefs.length > 5 ? ` and ${unmatchedPhotoRefs.length - 5} more` : ""}
            </p>
          ) : null}
        </div>

        {parseError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{parseError}</p>
          </div>
        ) : null}

        {parsedRows.length > 0 && !result ? (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2.5">
              <p className="text-sm font-medium text-foreground">
                Step 4: Preview ({parsedRows.length} student{parsedRows.length !== 1 ? "s" : ""})
              </p>
            </div>
            <div className="max-h-52 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Photo File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.map((row, index) => (
                    <tr key={`${row.full_name}-${index}`}>
                      <td className="px-3 py-1.5 text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-1.5">{row.full_name || "-"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.phone || "-"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.email || "-"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.student_type || "-"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.photo_file || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">{result.totalSuccess} Registered</span>
              </div>
              {result.totalSkipped > 0 ? (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">{result.totalSkipped} Skipped</span>
                </div>
              ) : null}
              {result.totalFailed > 0 ? (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-medium text-destructive">{result.totalFailed} Failed</span>
                </div>
              ) : null}
            </div>

            {photoOutcome ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">Photo upload summary</p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{photoOutcome.uploaded} photo{photoOutcome.uploaded !== 1 ? "s" : ""} uploaded</span>
                  <span>{photoOutcome.missing} missing file match{photoOutcome.missing !== 1 ? "es" : ""}</span>
                  <span>{photoOutcome.failed.length} photo upload failure{photoOutcome.failed.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ) : null}

            <div className="max-h-56 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Student</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.results.map((item) => {
                    const photoFailure = photoOutcome?.failed.find((failure) => failure.row === item.row);
                    return (
                      <tr key={`${item.row}-${item.name}`}>
                        <td className="px-3 py-2 text-muted-foreground">{item.row}</td>
                        <td className="px-3 py-2">{item.name || "-"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              item.success
                                ? item.skipped
                                  ? "text-blue-700"
                                  : "text-green-700"
                                : "text-destructive"
                            }
                          >
                            {item.success ? (item.skipped ? "Skipped" : "Success") : "Failed"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {item.error || "Registered successfully"}
                          {item.photoFile ? ` | photo: ${item.photoFile}` : ""}
                          {photoFailure ? ` | photo upload failed: ${photoFailure.error}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={uploading && !result}>
            Close
          </Button>
          {!result ? (
            <Button type="button" onClick={() => void handleUpload()} disabled={parsedRows.length === 0 || uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {uploading ? "Registering..." : "Register Students"}
            </Button>
          ) : uploading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading photos…</span>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
