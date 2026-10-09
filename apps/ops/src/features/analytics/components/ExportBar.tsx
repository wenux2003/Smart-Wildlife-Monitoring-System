import { Check, Download, FileDown, LoaderCircle } from "lucide-react";
import type { ReportRunResponse } from "@wr/shared";
import { useExport } from "../hooks/useExport.js";

export function ExportBar({ run }: { run: ReportRunResponse | null }) {
  const ready = run?.status === "SUCCEEDED" && run.report !== null;
  const { state, download } = useExport(ready && run ? run.runId : null);
  const formats = ["CSV", "PDF"] as const;
  return (
    <aside className="an-export-bar" aria-label="Report exports">
      <div className="an-export-status">
        <span
          className={ready ? "an-status-dot is-ready" : "an-status-dot"}
          aria-hidden="true"
        />
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
      {formats.some((format) => state[format] === "failed") && (
        <div className="an-export-error" role="alert">
          {formats
            .filter((format) => state[format] === "failed")
            .map((format) => (
              <p key={format}>
                The {format} could not be generated. Your report is still here.
                <button type="button" onClick={() => void download(format)}>
                  Retry {format}
                </button>
              </p>
            ))}
        </div>
      )}
      <div className="an-export-actions">
        {formats.map((format) => {
          const status = state[format];
          const idleLabel =
            format === "CSV" ? "Export data (CSV)" : "Export official PDF";
          return (
            <button
              key={format}
              type="button"
              className={`an-button an-export-button ${format === "CSV" ? "an-button-outline" : "an-button-primary"}`}
              disabled={!ready || status === "exporting"}
              aria-busy={status === "exporting"}
              onClick={() => void download(format)}
            >
              {status === "exporting" ? (
                <LoaderCircle
                  className="an-spin"
                  size={16}
                  aria-hidden="true"
                />
              ) : status === "done" ? (
                <Check
                  className="an-export-check"
                  size={16}
                  aria-hidden="true"
                />
              ) : format === "CSV" ? (
                <Download size={16} aria-hidden="true" />
              ) : (
                <FileDown size={16} aria-hidden="true" />
              )}
              <span className="an-export-label">
                <span className="an-export-label-measure" aria-hidden="true">
                  {idleLabel}
                </span>
                <span>
                  {status === "exporting"
                    ? `Preparing ${format}…`
                    : status === "done"
                      ? `${format} downloaded`
                      : idleLabel}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="an-sr-only" role="status" aria-atomic="true">
        {formats
          .filter((format) => state[format] === "done")
          .map((format) => `${format} download started.`)
          .join(" ")}
      </p>
      {ready && (
        <p className="an-export-ready">
          <Check size={14} aria-hidden="true" /> Snapshot preserved for
          reproducible downloads
        </p>
      )}
    </aside>
  );
}
