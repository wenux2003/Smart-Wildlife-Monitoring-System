import type {
  AnalyticsFilter,
  AnalyticsOptions,
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
