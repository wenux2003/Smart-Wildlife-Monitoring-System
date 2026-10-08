import { useState } from "react";
import { Check, Download, FileDown, LoaderCircle } from "lucide-react";
import type { ReportRunResponse } from "@wr/shared";
import { exportAnalyticsRun } from "../api.js";

export function ExportBar({ run }: { run: ReportRunResponse | null }) {
  const [pendingFormats, setPendingFormats] = useState<Set<"PDF" | "CSV">>(
    new Set(),
  );
  const [failedFormats, setFailedFormats] = useState<Set<"PDF" | "CSV">>(
    new Set(),
  );
  const ready = run?.status === "SUCCEEDED" && run.report !== null;

  async function exportFile(format: "PDF" | "CSV") {
    if (!run || !ready) return;
    setPendingFormats((formats) => new Set(formats).add(format));
    setFailedFormats((formats) => {
      const next = new Set(formats);
      next.delete(format);
      return next;
    });
    try {
      await exportAnalyticsRun(run.runId, format);
    } catch {
      setFailedFormats((formats) => new Set(formats).add(format));
    } finally {
      setPendingFormats((formats) => {
        const next = new Set(formats);
        next.delete(format);
        return next;
      });
    }
  }

  return (
    <aside className="an-export-bar" aria-label="Report exports">
      <div className="an-export-status">
        <span className={ready ? "an-status-dot is-ready" : "an-status-dot"} />
        <div>
          <strong>{ready ? "Ready to export" : "Report export"}</strong>
          <small>
            {ready
              ? run.code
              : run?.status === "EMPTY"
                ? "Nothing to export"
                : "Generate a report to enable downloads"}
          </small>
        </div>
      </div>
      {failedFormats.size > 0 && (
        <p className="an-export-error" role="alert">
          {Array.from(failedFormats).map((format) => (
            <span key={format}>
              The {format} could not be generated. Your report is still here.
              <button type="button" onClick={() => void exportFile(format)}>
                Retry {format}
              </button>
            </span>
          ))}
        </p>
      )}
      <div className="an-export-actions">
        <button
          type="button"
          className="an-button an-button-outline"
          disabled={!ready || pendingFormats.has("CSV")}
          aria-busy={pendingFormats.has("CSV")}
          onClick={() => void exportFile("CSV")}
        >
          {pendingFormats.has("CSV") ? (
            <LoaderCircle className="an-spin" size={16} />
          ) : (
            <Download size={16} />
          )}
          {pendingFormats.has("CSV") ? "Preparing CSV…" : "Export data (CSV)"}
        </button>
        <button
          type="button"
          className="an-button an-button-primary"
          disabled={!ready || pendingFormats.has("PDF")}
          aria-busy={pendingFormats.has("PDF")}
          onClick={() => void exportFile("PDF")}
        >
          {pendingFormats.has("PDF") ? (
            <LoaderCircle className="an-spin" size={16} />
          ) : (
            <FileDown size={16} />
          )}
          {pendingFormats.has("PDF") ? "Preparing PDF…" : "Export official PDF"}
        </button>
      </div>
      {ready && (
        <p className="an-export-ready">
          <Check size={14} /> Snapshot preserved for reproducible downloads
        </p>
      )}
    </aside>
  );
}
