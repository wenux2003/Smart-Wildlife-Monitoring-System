import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import type { ReportRunResponse } from "@wr/shared";

export function EmptyReport({
  onSuggestion,
}: {
  onSuggestion: (suggestion: string) => void;
}) {
  return (
    <section className="an-empty-report">
      <span className="an-empty-icon">
        <BarChart3 size={27} />
      </span>
      <p className="an-overline">READY WHEN YOU ARE</p>
      <h2>Choose filters and generate a report</h2>
      <p>
        Start with a recent period, then adjust the filters to explore
        conservation activity for your park.
      </p>
      <div className="an-preset-chips" aria-label="Suggested date ranges">
        {["LAST_30_DAYS", "LAST_90_DAYS", "LAST_6_MONTHS"].map((preset) => (
          <button
            type="button"
            key={preset}
            onClick={() => onSuggestion(preset)}
          >
            {preset === "LAST_30_DAYS"
              ? "Last 30 days"
              : preset === "LAST_90_DAYS"
                ? "Last 90 days"
                : "Last 6 months"}
          </button>
        ))}
      </div>
    </section>
  );
}

export function SkeletonReport() {
  return (
    <section className="an-skeleton" aria-label="Compiling report">
      <div className="an-skeleton-row">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="an-skeleton-row an-skeleton-body">
        <span />
        <span />
      </div>
    </section>
  );
}

export function TimeoutBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="an-timeout-banner" role="alert">
      <AlertTriangle size={19} />
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        <RefreshCw size={15} />
        Retry
      </button>
    </div>
  );
}

export function EmptyResult({
  run,
  onSuggestion,
}: {
  run: ReportRunResponse;
  onSuggestion: (suggestion: string) => void;
}) {
  return (
    <section className="an-empty-result">
      <p className="an-overline">NO MATCHING RECORDS</p>
      <h2>No records match these filters</h2>
      <p>Try a wider date range or include more incident categories.</p>
      <div className="an-preset-chips">
        {run.suggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => onSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}
