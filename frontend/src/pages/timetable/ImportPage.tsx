import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Upload, AlertCircle, CheckCircle } from "lucide-react";
import type { SlotSystem, TimetableImportCommitDecision } from "../../lib/api/types";
import {
  getSlotSystems,
  previewTimetableImport,
  commitTimetableImport,
} from "../../lib/api";

type Step = "select-system" | "upload-file" | "preview" | "map-columns" | "confirm";

interface PreviewData {
  batchId: number;
  validRows: number;
  unresolvedRows: number;
  processedRows: number;
  rows: Array<{
    rowId: number;
    courseCode: string;
    slot: string;
    classroom: string;
    classification: string;
  }>;
}

export function ImportPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("select-system");
  const [systems, setSystems] = useState<SlotSystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<number>(-1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [termStartDate, setTermStartDate] = useState("");
  const [termEndDate, setTermEndDate] = useState("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [commitReport, setCommitReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSystems = async () => {
      try {
        const data = await getSlotSystems();
        setSystems(data);
        if (data.length > 0) {
          setSelectedSystemId(data[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load slot systems");
      } finally {
        setLoading(false);
      }
    };

    loadSystems();
  }, []);

  const handleFileSelect = (event: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const file = event.type === "drop"
      ? (event as React.DragEvent<HTMLDivElement>).dataTransfer.files[0]
      : (event as React.ChangeEvent<HTMLInputElement>).target.files?.[0];

    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx"))) {
      setUploadedFile(file);
      setError(null);
    } else {
      setError("Please select a CSV or XLSX file");
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.add("border-blue-500", "bg-blue-50");
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove("border-blue-500", "bg-blue-50");
  };

  const handleUploadClick = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedSystemId === -1 || !uploadedFile || !termStartDate || !termEndDate) {
      setError("All fields are required");
      return;
    }

    if (new Date(termStartDate) >= new Date(termEndDate)) {
      setError("Term end date must be after start date");
      return;
    }

    setActionLoading(true);
    setError(null);
    setImportProgress(30);

    try {
      const report = await previewTimetableImport({
        slotSystemId: selectedSystemId,
        termStartDate,
        termEndDate,
        file: uploadedFile,
      });

      setImportProgress(70);

      setPreviewData({
        batchId: report.batchId,
        validRows: report.validRows,
        unresolvedRows: report.unresolvedRows,
        processedRows: report.processedRows,
        rows: report.rows.slice(0, 50),
      });

      setImportProgress(100);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to preview import");
    } finally {
      setActionLoading(false);
      setImportProgress(0);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) {
      setError("No preview data available");
      return;
    }

    setActionLoading(true);
    setError(null);
    setImportProgress(50);

    try {
      const decisions: TimetableImportCommitDecision[] = previewData.rows.map((row) => ({
        rowId: row.rowId,
        action: "AUTO",
      }));

      const report = await commitTimetableImport(previewData.batchId, decisions);

      setImportProgress(100);
      setCommitReport(report);
      setSuccessMessage(
        `Successfully imported ${report.autoCreatedBookings} bookings from ${report.processedRows} rows`
      );
      setStep("confirm");

      setTimeout(() => {
        navigate("/timetable/systems");
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to commit import");
    } finally {
      setActionLoading(false);
      setImportProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/timetable/systems")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Timetable</h1>
          <p className="text-gray-600 mt-1">
            Import timetable data from CSV or XLSX file
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {["select-system", "upload-file", "preview", "confirm"].map((s, idx) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`h-2 flex-1 rounded-full ${
                ["select-system", "upload-file", "preview", "confirm"].indexOf(
                  step
                ) >= idx
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
            />
          </div>
        ))}
      </div>

      {step === "select-system" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Step 1: Select Slot System</h2>
          <form onSubmit={(e) => { e.preventDefault(); setStep("upload-file"); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slot System
              </label>
              <select
                value={selectedSystemId}
                onChange={(e) => setSelectedSystemId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {systems.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={selectedSystemId === -1}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          </form>
        </div>
      )}

      {step === "upload-file" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Step 2: Upload File & Set Term Dates</h2>
          <form onSubmit={handleUploadClick} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term Start Date
                </label>
                <input
                  type="date"
                  value={termStartDate}
                  onChange={(e) => setTermStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term End Date
                </label>
                <input
                  type="date"
                  value={termEndDate}
                  onChange={(e) => setTermEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div
              onDrop={handleFileSelect}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600 mb-2">
                Drag and drop your CSV or XLSX file here
              </p>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <label className="inline-block">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                  Browse Files
                </span>
              </label>

              {uploadedFile && (
                <p className="text-green-600 mt-4 text-sm">
                  ✓ {uploadedFile.name} selected
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("select-system")}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={actionLoading || !uploadedFile || !termStartDate || !termEndDate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? "Uploading..." : "Continue"}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "preview" && previewData && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Step 3: Preview Imported Data</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Rows</p>
                <p className="text-2xl font-bold text-blue-600">{previewData.processedRows}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Valid Rows</p>
                <p className="text-2xl font-bold text-green-600">{previewData.validRows}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Unresolved</p>
                <p className="text-2xl font-bold text-amber-600">
                  {previewData.unresolvedRows}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold">Course</th>
                    <th className="text-left py-2 px-3 font-semibold">Slot</th>
                    <th className="text-left py-2 px-3 font-semibold">Room</th>
                    <th className="text-left py-2 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.slice(0, 20).map((row) => (
                    <tr key={row.rowId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3">{row.courseCode}</td>
                      <td className="py-2 px-3">{row.slot}</td>
                      <td className="py-2 px-3">{row.classroom}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            row.classification === "VALID_AND_AUTOMATABLE"
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {row.classification === "VALID_AND_AUTOMATABLE"
                            ? "Valid"
                            : "Unresolved"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.rows.length > 20 && (
              <p className="text-sm text-gray-500 mt-4">
                Showing 20 of {previewData.rows.length} rows
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setStep("upload-file");
                  setPreviewData(null);
                }}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? "Importing..." : "Confirm & Import"}
              </button>
            </div>
          </div>

          {importProgress > 0 && importProgress < 100 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{importProgress}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "confirm" && commitReport && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Import Complete!
            </h2>
            <p className="text-gray-600">
              {commitReport.autoCreatedBookings} bookings created from{" "}
              {commitReport.processedRows} processed rows
            </p>
          </div>

          {commitReport.failedOccurrences > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-900 mb-2">Issues</h3>
              <ul className="space-y-1 text-sm text-red-800">
                <li>• {commitReport.failedOccurrences} failed occurrences</li>
                {commitReport.bookingConflictRows > 0 && (
                  <li>• {commitReport.bookingConflictRows} conflicts</li>
                )}
                {commitReport.unresolvedRows > 0 && (
                  <li>• {commitReport.unresolvedRows} unresolved rows</li>
                )}
              </ul>
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Redirecting to slot systems in 3 seconds...
            </p>
            <button
              onClick={() => navigate("/timetable/systems")}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Slot Systems
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
