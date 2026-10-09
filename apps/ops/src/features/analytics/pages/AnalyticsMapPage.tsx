import type { ConservationReport } from "@wr/shared";
import { AnalyticsMap } from "../components/AnalyticsMap.js";
import { AnalyticsSubpageLayout } from "../components/AnalyticsSubpageLayout.js";

export function AnalyticsMapPage() {
  return (
    <AnalyticsSubpageLayout section="map">
      {(report: ConservationReport) => <AnalyticsMap report={report} />}
    </AnalyticsSubpageLayout>
  );
}
