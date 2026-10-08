import type { ConservationReport } from "@wr/shared";
export function narrative(
  report: Pick<
    ConservationReport,
    "kpis" | "window" | "breakdown" | "patrolGaps"
  >,
): string[] {
  const { kpis: k } = report;
  const sentences: string[] = [];
  if (
    k.totalIncidents >= 5 &&
    k.previousPeriodIncidents >= 5 &&
    k.changePercent !== null &&
    k.changePercent !== 0
  )
    sentences.push(
      "Incidents " +
        (k.changePercent > 0 ? "rose " : "fell ") +
        Math.abs(k.changePercent) +
        "% compared with the previous " +
        report.window.days +
        " days.",
    );
  const top = report.breakdown[0];
  if (top && top.count >= 5)
    sentences.push(
      "The largest group was " +
        top.type.replaceAll("_", " ").toLowerCase() +
        " in " +
        top.sectorName +
        " (" +
        top.count +
        " incidents).",
    );
  if (!report.patrolGaps.configured)
    sentences.push("Patrol gap analysis is not configured for this park.");
  if (k.communityConflictReports || k.collarBreaches)
    sentences.push(
      "Community reports and collar breaches are separate sources, not deduplicated real-world conflicts.",
    );
  return sentences;
}
