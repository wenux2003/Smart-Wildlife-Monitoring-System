import type {
  AnalyticsFilter,
  AnalyticsOptions,
  ConservationReport,
  ReportRunResponse,
} from "@wr/shared";
import type { NormalizedFilter } from "./domain/filter.js";
import type { ReportSections } from "./domain/report-assembler.js";
export interface AnalyticsRepository {
  options(parkId: string): Promise<AnalyticsOptions>;
  load(
    filter: NormalizedFilter,
    generatedAt: Date,
  ): Promise<AnalyticsQueryResult>;
  close?(): Promise<void>;
}
export type AnalyticsQueryResult = {
  sections: ReportSections;
  hasPatrolPoints: boolean;
};
export type StoredRun = ReportRunResponse & {
  parkId: string;
  requestedBy: string;
  requesterName: string;
  requesterRole: string;
  filters: AnalyticsFilter;
  durationMs: number;
  createdAt: string;
};
export type NewRun = Omit<StoredRun, "runId" | "code"> & {
  parkCode: string;
  errorCode: string | null;
};
export type ExportAttempt = {
  runId: string;
  requestedBy: string;
  format: "PDF" | "CSV";
  status: "SUCCEEDED" | "FAILED";
  byteSize: number | null;
  fileSha256: string | null;
  errorCode: string | null;
};
export type ReportFormat = ExportAttempt["format"];
export type StoredReportExport = {
  id: string;
  format: ReportFormat;
  status: "SUCCEEDED" | "FAILED";
  byteSize: number | null;
  fileSha256: string | null;
  errorCode: string | null;
  createdAt: string;
};
export type ReportHistoryRecord = {
  run: StoredRun;
  exports: StoredReportExport[];
};
export interface ReportAuditRepository {
  insertRun(input: NewRun): Promise<StoredRun>;
  getRun(
    id: string,
    parkId: string,
    userId: string | null,
  ): Promise<StoredRun | null>;
  history(
    parkId: string,
    userId: string | null,
    page: number,
    pageSize: number,
    status?: string,
    from?: string,
    to?: string,
  ): Promise<{ items: ReportHistoryRecord[]; total: number }>;
  insertExport(input: ExportAttempt): Promise<void>;
  close?(): Promise<void>;
}
export type ReportExporter = {
  format: "PDF" | "CSV";
  mimeType: string;
  extension: string;
  render(run: StoredRun & { report: ConservationReport }): Promise<Buffer>;
};
