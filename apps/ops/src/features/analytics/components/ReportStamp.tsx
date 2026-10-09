import type { ReportRunResponse } from "@wr/shared";

export function ReportStamp({ run }: { run: ReportRunResponse }) {
  if (run.status !== "SUCCEEDED" || !run.report) return null;
  return (
    <div className="an-report-stamp is-compiled" key={run.runId}>
      <span className="an-stamp-dot" aria-hidden="true" />
      <strong>{run.code}</strong>
      <span>
        Compiled{" "}
        {new Intl.DateTimeFormat("en-LK", {
          timeZone: "Asia/Colombo",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(run.report.generatedAt))}
      </span>
    </div>
  );
}
