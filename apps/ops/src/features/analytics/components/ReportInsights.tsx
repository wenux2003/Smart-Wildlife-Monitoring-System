import type { ConservationReport } from "@wr/shared";

export function ReportInsights({ report }: { report: ConservationReport }) {
  return (
    <section className="an-panel">
      <p className="an-overline">ANALYSIS</p>
      <h2>Key insights</h2>
      {report.summarySentences.length ? (
        <ul className="an-insight-list">
          {report.summarySentences.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      ) : (
        <p className="an-muted-copy">No additional insights for this report.</p>
      )}
    </section>
  );
}
