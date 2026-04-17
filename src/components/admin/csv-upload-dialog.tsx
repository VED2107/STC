"use client";

import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import {
  bulkUploadStudents,
  type BulkStudentRow,
  type BulkUploadResponse,
} from "@/app/actions/bulk-upload-students";
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

export function CsvUploadDialog({ open, onOpenChange, onSuccess }: CsvUploadDialogProps) {
  const [parsedRows, setParsedRows] = useState<BulkStudentRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResponse | null>(null);
  const [parseError, setParseError] = useState("");

  const resetState = useCallback(() => {
    setParsedRows([]);
    setFileName("");
    setUploading(false);
    setResult(null);
    setParseError("");
  }, []);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setResult(null);
    setFileName(file.name);

    try {
      let rows: Record<string, string>[];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        rows = parseCSVText(text);
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

      // Normalize column names
      const normalized = rows.map((row) => ({
        full_name: row["full_name"] || row["name"] || row["fullname"] || row["student_name"] || "",
        email: row["email"] || row["e-mail"] || "",
        phone: row["phone"] || row["mobile"] || row["phone_number"] || "",
        class_name: row["class_name"] || row["class"] || row["className"] || "",
        student_type: row["student_type"] || row["type"] || "tuition",
        fees_amount: row["fees_amount"] || row["fees"] || row["fee"] || row["fees_amount_(inr)"] || "0",
        fees_installment1_paid: row["fees_installment1_paid"] || row["installment_1_paid"] || row["inst1"] || "no",
        fees_installment2_paid: row["fees_installment2_paid"] || row["installment_2_paid"] || row["inst2"] || "no",
      }));

      setParsedRows(normalized);
    } catch (err) {
      setParseError(`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    // Reset file input
    e.target.value = "";
  }

  async function handleUpload() {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setResult(null);

    try {
      const response = await bulkUploadStudents(parsedRows);
      setResult(response);
      if (response.totalSuccess > 0) {
        onSuccess();
      }
    } catch (err) {
      setResult({
        results: [{ row: 0, name: "", success: false, error: err instanceof Error ? err.message : "Upload failed" }],
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Student Registration
          </DialogTitle>
          <DialogDescription>
            Download the template, fill in student details, then upload to register students in bulk.
            Default password for all registered students: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">STC@123</code>
          </DialogDescription>
        </DialogHeader>

        {/* Template Download */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">Step 1: Download Template</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Download the template with all required columns, fill in student details, and upload below.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadBulkTemplateCSV}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              CSV Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadBulkTemplateXLSX()}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Excel Template
            </Button>
          </div>
        </div>

        {/* File Upload */}
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">Step 2: Upload Filled File</p>
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
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
          </label>
          {fileName && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{fileName}</span>
              <button
                type="button"
                onClick={() => { setParsedRows([]); setFileName(""); setResult(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {parseError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{parseError}</p>
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && !result && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2.5">
              <p className="text-sm font-medium text-foreground">
                Step 3: Preview ({parsedRows.length} student{parsedRows.length !== 1 ? "s" : ""})
              </p>
            </div>
            <div className="max-h-52 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Class</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Fees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5">{row.full_name || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.email || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.phone || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.class_name || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.student_type || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">₹{row.fees_amount || "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">{result.totalSuccess} Registered</span>
              </div>
              {(result.totalSkipped ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">{result.totalSkipped} Skipped (already enrolled)</span>
                </div>
              )}
              {result.totalFailed > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-medium text-destructive">{result.totalFailed} Failed</span>
                </div>
              )}
            </div>

            {(result.totalSkipped ?? 0) > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  ℹ️ Skipped students already exist in the database. Their existing data was preserved and not overwritten.
                </p>
              </div>
            )}

            {result.results.filter((r) => !r.success && !r.skipped).length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="mb-2 text-xs font-medium text-destructive">Errors:</p>
                {result.results
                  .filter((r) => !r.success && !r.skipped)
                  .map((r, i) => (
                    <p key={i} className="text-xs text-destructive/80">
                      Row {r.row} ({r.name || "unknown"}): {r.error}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && parsedRows.length > 0 && (
            <Button onClick={() => void handleUpload()} disabled={uploading}>
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register {parsedRows.length} Student{parsedRows.length !== 1 ? "s" : ""}
            </Button>
          )}
          {result && result.totalFailed > 0 && (
            <Button variant="outline" onClick={resetState}>
              Try Again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
