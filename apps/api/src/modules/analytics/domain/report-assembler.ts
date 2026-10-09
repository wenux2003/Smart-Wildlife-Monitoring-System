import { createHash } from "node:crypto";
import { ConservationReportSchema, type ConservationReport } from "@wr/shared";
import { narrative } from "./narrative.js";
export type ReportSections = Omit<
  ConservationReport,
  "schemaVersion" | "summarySentences"
>;
/** Validation strips unknown fields, preventing accidental private fields entering snapshots. */
export function assembleReport(sections: ReportSections): {
  report: ConservationReport;
  snapshotSha256: string;
} {
  const report = ConservationReportSchema.parse({
    ...sections,
    schemaVersion: 1,
    summarySentences: narrative(sections),
  });
  return {
    report,
    snapshotSha256: createHash("sha256")
      .update(JSON.stringify(report))
      .digest("hex"),
  };
}
