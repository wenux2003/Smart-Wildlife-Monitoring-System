import type {
  AnalyticsFilter,
  AnalyticsOptions,
  ReportHistoryQuery,
  ReportHistoryResponse,
  ReportRunResponse,
} from "@wr/shared";
import { apiRequest, downloadApiFile } from "../../api.js";
import { saveBlob } from "./lib/download.js";

export function getAnalyticsOptions(parkId: string): Promise<AnalyticsOptions> {
  return apiRequest(
    `/api/analytics/options?parkId=${encodeURIComponent(parkId)}`,
  );
}

export function generateAnalyticsReport(
  filter: AnalyticsFilter,
): Promise<ReportRunResponse> {
  return apiRequest("/api/reports/runs", { method: "POST", body: filter });
}

export function getAnalyticsRun(runId: string): Promise<ReportRunResponse> {
  return apiRequest(`/api/reports/runs/${encodeURIComponent(runId)}`);
}

export function listReportRuns(
  query: Partial<ReportHistoryQuery>,
): Promise<ReportHistoryResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return apiRequest(`/api/reports/runs?${params.toString()}`);
}

export async function exportAnalyticsRun(
  runId: string,
  format: "PDF" | "CSV",
): Promise<void> {
  const file = await downloadApiFile(
    `/api/reports/runs/${encodeURIComponent(runId)}/exports`,
    { format },
  );
  saveBlob(file.filename, file.blob);
}
