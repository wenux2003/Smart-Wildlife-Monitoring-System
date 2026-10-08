import { useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { ConservationReport } from "@wr/shared";
import "leaflet/dist/leaflet.css";

type Coordinates = { longitude: number; latitude: number };

function positions(ring: Coordinates[]): LatLngExpression[] {
  return ring.map(({ latitude, longitude }) => [latitude, longitude]);
}

function multiPolygonPositions(
  polygon: Coordinates[][][],
): LatLngExpression[][][] {
  return polygon.map((part) => part.map(positions));
}

function displayDate(value: string | null | undefined): string {
  return value
    ? new Intl.DateTimeFormat("en-LK", {
        timeZone: "Asia/Colombo",
        dateStyle: "medium",
      }).format(new Date(value))
    : "No patrol record";
}

const riskColors = ["#fef3c7", "#fde68a", "#fdba74", "#f97316", "#b91c1c"];

export function AnalyticsMap({
  report,
  initialMode = "hotspots",
}: {
  report: ConservationReport;
  initialMode?: "hotspots" | "coverage";
}) {
  const [showBoundary, setShowBoundary] = useState(true);
  const [showSectors, setShowSectors] = useState(true);
  const [showHotspots, setShowHotspots] = useState(initialMode === "hotspots");
  const [showCoverage, setShowCoverage] = useState(initialMode === "coverage");
  const [showCovered, setShowCovered] = useState(false);
  const [showPriority, setShowPriority] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    "id" | "incidents" | "risk" | "coverage"
  >("id");
  const [sortDescending, setSortDescending] = useState(false);
  const cells = useMemo(() => {
    const byId = new Map<
      string,
      {
        id: string;
        hotspot: ConservationReport["hotspots"]["cells"][number] | null;
        coverage: ConservationReport["patrolGaps"]["cells"][number] | null;
      }
    >();
    for (const hotspot of report.hotspots.cells)
      byId.set(hotspot.cellId, {
        id: hotspot.cellId,
        hotspot,
        coverage:
          report.patrolGaps.cells.find(
            (cell) => cell.cellId === hotspot.cellId,
          ) ?? null,
      });
    for (const coverage of report.patrolGaps.cells) {
      const item = byId.get(coverage.cellId);
      if (item) item.coverage = coverage;
      else
        byId.set(coverage.cellId, {
          id: coverage.cellId,
          hotspot: null,
          coverage,
        });
    }
    return [...byId.values()];
  }, [report]);
  const sortedCells = cells.slice().sort((a, b) => {
    let difference = 0;
    if (sortBy === "id") difference = a.id.localeCompare(b.id);
    else if (sortBy === "incidents")
      difference = (a.hotspot?.count ?? 0) - (b.hotspot?.count ?? 0);
    else if (sortBy === "risk")
      difference = (a.hotspot?.riskClass ?? 0) - (b.hotspot?.riskClass ?? 0);
    else
      difference =
        Number(Boolean(a.coverage?.covered)) -
        Number(Boolean(b.coverage?.covered));
    return (sortDescending ? -1 : 1) * difference || a.id.localeCompare(b.id);
  });
  function sortCells(field: typeof sortBy) {
    if (sortBy === field) setSortDescending((descending) => !descending);
    else {
      setSortBy(field);
      setSortDescending(field !== "id");
    }
  }
  const fallback =
    report.hotspots.cells[0]?.polygon[0] ??
    report.patrolGaps.cells[0]?.polygon[0];
  const firstBoundary = report.spatialContext.parkBoundary?.[0]?.[0]?.[0];
  const center: LatLngExpression = firstBoundary
    ? [firstBoundary.latitude, firstBoundary.longitude]
    : fallback
      ? [fallback.latitude, fallback.longitude]
      : [6.5, 81.4];
  const priorityRanks = new Map(
    report.priorityCells.map((cell, index) => [cell.cellId, index + 1]),
  );
  const layerToggles: {
    label: string;
    checked: boolean;
    setChecked: (checked: boolean) => void;
  }[] = [
    {
      label: "Park boundary",
      checked: showBoundary,
      setChecked: setShowBoundary,
    },
    {
      label: "Sector outlines",
      checked: showSectors,
      setChecked: setShowSectors,
    },
    {
      label: "Hotspot cells",
      checked: showHotspots,
      setChecked: setShowHotspots,
    },
    {
      label: "Coverage gaps",
      checked: showCoverage,
      setChecked: setShowCoverage,
    },
    {
      label: "Priority cells",
      checked: showPriority,
      setChecked: setShowPriority,
    },
  ];

  return (
    <section className="an-panel an-map-panel">
      <div className="an-panel-heading">
        <div>
          <p className="an-overline">SPATIAL ANALYSIS</p>
          <h2>
            {initialMode === "coverage" ? "Patrol coverage map" : "Hotspot map"}
          </h2>
        </div>
        <button
          type="button"
          className="an-button an-button-outline"
          aria-expanded={showTable}
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? "Hide data table" : "View as table"}
        </button>
      </div>
      <div className="an-map-layout">
        <div
          className="an-map"
          role="region"
          aria-label={`Conservation map with ${report.hotspots.cells.length} hotspot cells and ${report.patrolGaps.cells.length} patrol coverage cells`}
        >
          <MapContainer center={center} zoom={9} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {showBoundary &&
              report.spatialContext.parkBoundary?.map((polygon, index) => (
                <Polygon
                  key={`boundary-${index}`}
                  positions={multiPolygonPositions([polygon])}
                  pathOptions={{
                    color: "#14532d",
                    fillOpacity: 0.015,
                    weight: 3,
                  }}
                />
              ))}
            {showSectors &&
              report.spatialContext.sectors.map((sector) =>
                sector.polygon.map((polygon, index) => (
                  <Polygon
                    key={`${sector.id}-${index}`}
                    positions={multiPolygonPositions([polygon])}
                    pathOptions={{
                      color:
                        sector.kind === "BOUNDARY_STRETCH"
                          ? "#2563eb"
                          : "#64748b",
                      fillOpacity: 0,
                      weight: 1,
                      dashArray:
                        sector.kind === "BOUNDARY_STRETCH" ? "4 5" : "2 5",
                    }}
                  >
                    <Tooltip permanent direction="center">
                      {sector.name}
                    </Tooltip>
                  </Polygon>
                )),
              )}
            {showCoverage &&
              report.patrolGaps.cells
                .filter((cell) => showCovered || !cell.covered)
                .map((cell) => (
                  <Polygon
                    key={`coverage-${cell.cellId}`}
                    positions={positions(cell.polygon)}
                    pathOptions={{
                      color: priorityRanks.has(cell.cellId)
                        ? "#b91c1c"
                        : selectedCell === cell.cellId
                          ? "#111827"
                          : "#475569",
                      fillColor: cell.covered ? "#22c55e" : "#94a3b8",
                      fillOpacity: cell.covered ? 0.12 : 0.3,
                      weight: priorityRanks.has(cell.cellId)
                        ? 3
                        : selectedCell === cell.cellId
                          ? 4
                          : 1,
                      dashArray: cell.covered ? undefined : "5 4",
                    }}
                    eventHandlers={{
                      click: () => setSelectedCell(cell.cellId),
                    }}
                  >
                    <Popup>
                      <strong>{cell.cellId}</strong>
                      <br />
                      {cell.covered ? "Patrolled" : "No valid patrol track"}
                      <br />
                      Last patrolled:{" "}
                      {cell.lastPatrolledAt
                        ? displayDate(cell.lastPatrolledAt)
                        : "Never"}
                    </Popup>
                  </Polygon>
                ))}
            {showHotspots &&
              report.hotspots.cells.map((cell) => (
                <Polygon
                  key={`hotspot-${cell.cellId}`}
                  positions={positions(cell.polygon)}
                  pathOptions={{
                    color: priorityRanks.has(cell.cellId)
                      ? "#b91c1c"
                      : selectedCell === cell.cellId
                        ? "#111827"
                        : "#b45309",
                    fillColor: riskColors[cell.riskClass - 1],
                    fillOpacity: 0.55,
                    weight: priorityRanks.has(cell.cellId)
                      ? 3
                      : selectedCell === cell.cellId
                        ? 4
                        : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelectedCell(cell.cellId) }}
                >
                  <Popup>
                    <strong>{cell.sectorName ?? "Unknown sector"}</strong>
                    <br />
                    {cell.count} incidents · risk class {cell.riskClass} of 5
                    <br />
                    Last patrolled:{" "}
                    {displayDate(
                      report.patrolGaps.cells.find(
                        (covered) => covered.cellId === cell.cellId,
                      )?.lastPatrolledAt,
                    )}
                  </Popup>
                </Polygon>
              ))}
            {showPriority &&
              report.priorityCells.map((cell, index) => (
                <CircleMarker
                  key={`priority-${cell.cellId}`}
                  center={[cell.centre.latitude, cell.centre.longitude]}
                  radius={9}
                  pathOptions={{
                    color: "#991b1b",
                    fillColor: "#fee2e2",
                    fillOpacity: 1,
                    weight: 3,
                  }}
                >
                  <Tooltip permanent direction="center">
                    {index + 1}
                  </Tooltip>
                </CircleMarker>
              ))}
          </MapContainer>
        </div>
        <aside className="an-map-side" aria-label="Map layers and legend">
          <p className="an-overline">MAP LAYERS</p>
          {layerToggles.map(({ label, checked, setChecked }) => (
            <label key={label} className="an-map-toggle">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              />
              {label}
            </label>
          ))}
          <label className="an-map-toggle an-map-subtoggle">
            <input
              type="checkbox"
              checked={showCovered}
              onChange={(event) => setShowCovered(event.target.checked)}
              disabled={!showCoverage}
            />
            Show covered cells
          </label>
          <div className="an-map-legend">
            <strong>Incident risk</strong>
            {riskColors.map((color, index) => (
              <span key={color}>
                <i style={{ backgroundColor: color }} />
                Class {index + 1}
              </span>
            ))}
            <span>
              <i className="an-legend-gap" /> Patrol gap
            </span>
            <span>
              <i className="an-legend-boundary" /> Park boundary
            </span>
          </div>
          <p className="an-map-note">
            {report.hotspots.cells.length} hotspot cells ·{" "}
            {report.patrolGaps.cells.filter((cell) => !cell.covered).length}{" "}
            coverage gaps · {report.priorityCells.length} priority cells.
          </p>
          <p className="an-map-note">
            {report.dataQuality.excludedNoLocation} incidents are not mapped
            because they have no resolved location;{" "}
            {report.dataQuality.outsideBoundary} located incidents are outside
            the park boundary.
          </p>
          {report.priorityCells.length > 0 && (
            <ol className="an-priority-list">
              {report.priorityCells.map((cell) => (
                <li key={cell.cellId}>
                  <button
                    type="button"
                    onClick={() => setSelectedCell(cell.cellId)}
                  >
                    {cell.sectorName ?? cell.cellId} · {cell.incidents}{" "}
                    incidents
                    {" · "}
                    {cell.daysSincePatrol ?? "never"} days since patrol
                    <span className="an-sr-only">
                      (rank {priorityRanks.get(cell.cellId)})
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
      {showTable && (
        <div className="an-cell-table-wrap">
          <table className="an-table">
            <caption>Hotspot and coverage cell details</caption>
            <thead>
              <tr>
                <th scope="col">
                  <button
                    type="button"
                    className="an-text-button"
                    onClick={() => sortCells("id")}
                  >
                    Cell
                  </button>
                </th>
                <th scope="col">Sector</th>
                <th scope="col">
                  <button
                    type="button"
                    className="an-text-button"
                    onClick={() => sortCells("incidents")}
                  >
                    Incidents
                  </button>
                </th>
                <th scope="col">
                  <button
                    type="button"
                    className="an-text-button"
                    onClick={() => sortCells("risk")}
                  >
                    Risk class
                  </button>
                </th>
                <th scope="col">
                  <button
                    type="button"
                    className="an-text-button"
                    onClick={() => sortCells("coverage")}
                  >
                    Patrol status
                  </button>
                </th>
                <th scope="col">Last patrolled</th>
                <th scope="col">Map</th>
              </tr>
            </thead>
            <tbody>
              {sortedCells.map(({ id, hotspot, coverage }) => (
                <tr
                  key={id}
                  className={selectedCell === id ? "is-selected" : undefined}
                >
                  <th scope="row">{id}</th>
                  <td>{hotspot?.sectorName ?? "—"}</td>
                  <td>{hotspot?.count ?? 0}</td>
                  <td>{hotspot ? `${hotspot.riskClass} of 5` : "—"}</td>
                  <td>
                    {coverage
                      ? coverage.covered
                        ? "Covered"
                        : "Gap"
                      : "Unknown"}
                  </td>
                  <td>{coverage?.lastPatrolledAt ?? "Never"}</td>
                  <td>
                    <button
                      type="button"
                      className="an-text-button"
                      onClick={() => setSelectedCell(id)}
                    >
                      Highlight
                    </button>
                  </td>
                </tr>
              ))}
              {cells.length === 0 && (
                <tr>
                  <td colSpan={7}>No spatial cells match this report.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
