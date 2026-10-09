import PdfPrinter from "pdfmake";
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { ConservationReport } from "@wr/shared";
import { AppError } from "../../../core/errors.js";
import type { ReportExporter, StoredRun } from "../types.js";
import {
  chartColors,
  conflictChartSvg,
  horizontalBarSvg,
  riskRamp,
  spatialMapSvg,
  trendChartSvg,
} from "./svg-charts.js";

const MAX_PDF_PAGES = 12;
const CONTENT_WIDTH = 511; // A4 width (595) minus 42 pt margins on both sides
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};
const printer = new PdfPrinter(fonts);

// ---------------------------------------------------------------- wording

const TYPE_LABELS: Record<string, string> = {
  POACHING: "Poaching",
  SNARE_FOUND: "Snare found",
  INJURED_ANIMAL: "Injured animal",
  FENCE_DAMAGE: "Fence damage",
  HUMAN_WILDLIFE_CONFLICT: "Human-wildlife conflict",
  CROP_DAMAGE: "Crop damage",
  OTHER: "Other",
};
const GROUP_LABELS: Record<string, string> = {
  ALL: "All categories",
  POACHING_AND_SNARES: "Poaching & snares",
  HUMAN_WILDLIFE_CONFLICT: "Human-wildlife conflict",
  ANIMAL_WELFARE: "Animal welfare",
  OTHER: "Other",
};
const SOURCE_LABELS: Record<string, string> = {
  RANGER: "Ranger",
  COMMUNITY: "Community",
  CAMERA_TRAP: "Camera trap",
};
const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#b91c1c",
  HIGH: "#b45309",
  MEDIUM: "#1d4ed8",
  LOW: "#64748b",
};
const label = (map: Record<string, string>, code: string) => map[code] ?? code;
const num = (value: number) => value.toLocaleString("en-US");
const km2 = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} km²`;
const percent = (value: number) => `${value.toFixed(1)}%`;

function dateInColombo(value: string, includeTime = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).format(new Date(value));
}
function monthLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

function changeText(report: ConservationReport): string {
  const k = report.kpis;
  const versus = `vs previous ${report.window.days} days (${num(k.previousPeriodIncidents)})`;
  if (k.changeKind === "NEW_ACTIVITY") return `New activity ${versus}`;
  if (k.changeKind === "NO_CHANGE" || k.changePercent === null) return `No change ${versus}`;
  return `${k.changeKind === "UP" ? "Up" : "Down"} ${Math.abs(k.changePercent).toFixed(1)}% ${versus}`;
}

// ---------------------------------------------------------------- building blocks

/** Section heading: small green overline, title and a thin rule. */
function section(overline: string, title: string, pageBreak = false): Content {
  return {
    stack: [
      { text: overline.toUpperCase(), fontSize: 7.5, bold: true, color: chartColors.forest, characterSpacing: 1.2 },
      { text: title, fontSize: 15, bold: true, color: chartColors.forestDark, margin: [0, 2, 0, 4] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.8, lineColor: "#dce5dc" }] },
    ],
    margin: [0, pageBreak ? 0 : 16, 0, 8],
    ...(pageBreak ? { pageBreak: "before" as const } : {}),
  };
}

/** Keeps a heading together with its chart or table: the group moves to the next page instead of splitting. */
function keep(...items: Content[]): Content {
  return { stack: items, unbreakable: true };
}

function note(text: string): Content {
  return { text, fontSize: 8, color: chartColors.muted, margin: [0, 2, 0, 6] };
}

/** KPI cards in one row: label, large value and a short explanation. */
function kpiCards(cards: { label: string; value: string; note: string; accent?: string }[]): Content {
  return {
    table: {
      widths: cards.map(() => "*"),
      body: [
        cards.map((card): TableCell => ({
          stack: [
            { text: card.label.toUpperCase(), fontSize: 7, bold: true, color: chartColors.muted, characterSpacing: 0.8 },
            { text: card.value, fontSize: card.value.length > 12 ? 12.5 : 17, bold: true, color: card.accent ?? chartColors.forestDark, margin: [0, 4, 0, 3] },
            { text: card.note, fontSize: 7.5, color: chartColors.text },
          ],
          fillColor: "#f4f7f3",
          margin: [8, 8, 8, 8],
        })),
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 0 || i === cards.length ? 0 : 6),
      vLineColor: () => "#ffffff",
    },
    margin: [0, 2, 0, 6],
  };
}

type Align = "left" | "right" | "center";

/** Data table with a tinted header, light zebra rows and right-aligned numbers. */
function table(
  headers: string[],
  rows: TableCell[][],
  options: { widths?: (number | "*" | "auto")[]; align?: Align[]; empty?: string } = {},
): Content {
  const align = options.align ?? headers.map((): Align => "left");
  const body: TableCell[][] = [
    headers.map((text, i): TableCell => ({
      text,
      bold: true,
      fontSize: 8,
      color: chartColors.forestDark,
      fillColor: "#edf2ec",
      alignment: align[i],
    })),
  ];
  if (rows.length)
    rows.forEach((row) =>
      body.push(
        row.map((cell, i): TableCell =>
          typeof cell === "object" && cell !== null && !Array.isArray(cell)
            ? { alignment: align[i], ...cell }
            : { text: String(cell), alignment: align[i] },
        ),
      ),
    );
  else
    body.push([
      { text: options.empty ?? "Nothing to show.", italics: true, color: chartColors.muted, colSpan: headers.length },
      ...headers.slice(1).map((): TableCell => ({ text: "" })),
    ]);
  return {
    table: { headerRows: 1, dontBreakRows: true, widths: options.widths ?? headers.map(() => "*"), body },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : 0.6),
      vLineWidth: () => 0,
      hLineColor: () => "#dce5dc",
      fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex % 2 === 0 ? "#fafcfa" : null),
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    fontSize: 8.5,
    margin: [0, 4, 0, 8],
  };
}

function legend(items: { swatch: string; label: string; outline?: string }[]): Content {
  const cells = items.map((item): TableCell => ({
    columns: [
      { canvas: [{ type: "rect", x: 0, y: 1, w: 9, h: 9, r: 1.5, color: item.swatch, lineColor: item.outline ?? "#94a3b8", lineWidth: 0.6 }], width: 13 },
      { text: item.label, fontSize: 7.5, color: chartColors.text },
    ],
  }));
  const rows: TableCell[][] = [];
  for (let i = 0; i < cells.length; i += 4) {
    const row = cells.slice(i, i + 4);
    while (row.length < 4) row.push({ text: "" });
    rows.push(row);
  }
  return { table: { widths: ["*", "*", "*", "*"], body: rows }, layout: "noBorders", margin: [0, 2, 0, 8] };
}

/** Period/count pairs laid out in three side-by-side column groups to save space. */
function compactTrendTable(trend: ConservationReport["trend"]): Content {
  const groups = 3;
  const perGroup = Math.ceil(trend.length / groups);
  const rows: TableCell[][] = [];
  for (let r = 0; r < perGroup; r++) {
    const row: TableCell[] = [];
    for (let g = 0; g < groups; g++) {
      const point = trend[g * perGroup + r];
      row.push(point ? point.label : "", point ? { text: num(point.count), bold: point.count > 0 } : "");
    }
    rows.push(row);
  }
  return table(
    ["Period", "Incidents", "Period", "Incidents", "Period", "Incidents"],
    rows,
    { widths: ["*", 50, "*", 50, "*", 50], align: ["left", "right", "left", "right", "left", "right"] },
  );
}

// ---------------------------------------------------------------- the document

function reportDefinition(run: StoredRun & { report: ConservationReport }): TDocumentDefinitions {
  const report = run.report;
  const snapshotHash = run.snapshotSha256;
  if (!snapshotHash)
    throw new AppError("This report is missing its integrity hash.", 409, "REPORT_NOT_EXPORTABLE");
  const { kpis, dataQuality, patrolGaps, conflicts, spatialContext } = report;
  const method = report.method;
  const sectorName = report.filters.sectorId
    ? spatialContext.sectors.find((s) => s.id === report.filters.sectorId)?.name ?? "Selected sector"
    : "All sectors";

  // --- cover -----------------------------------------------------------------
  const cover: Content[] = [
    {
      table: {
        widths: ["*"],
        body: [[{
          stack: [
            { text: "DEPARTMENT OF WILDLIFE CONSERVATION — SRI LANKA (PROTOTYPE)", fontSize: 7.5, bold: true, color: "#bbf7d0", characterSpacing: 1 },
            { text: "Conservation Outcome Report", fontSize: 24, bold: true, color: "#ffffff", margin: [0, 6, 0, 2] },
            { text: report.park.name, fontSize: 14, bold: true, color: "#dcfce7" },
            { text: `${dateInColombo(report.filters.from)} – ${dateInColombo(report.filters.to)}  ·  Asia/Colombo time`, fontSize: 9.5, color: "#dcfce7", margin: [0, 6, 0, 0] },
          ],
          fillColor: chartColors.forestDark,
          margin: [16, 16, 16, 16],
        }]],
      },
      layout: "noBorders",
    },
    {
      table: {
        widths: ["*", "*", "*"],
        body: [
          [
            { stack: [{ text: "REPORT CODE", style: "metaLabel" }, { text: run.code, style: "metaValue" }] },
            { stack: [{ text: "GENERATED", style: "metaLabel" }, { text: `${dateInColombo(report.generatedAt, true)}`, style: "metaValue" }] },
            { stack: [{ text: "GENERATED BY", style: "metaLabel" }, { text: `${run.requesterName}`, style: "metaValue" }, { text: label({ PARK_MANAGER: "Park Manager", RESEARCHER: "Researcher" }, run.requesterRole), fontSize: 8, color: chartColors.muted }] },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 12, 0, 4],
    },
    section("Report parameters", "Filters"),
    table(
      ["Category", "Incident types", "Sources", "Sector", "Rejected reports"],
      [[
        label(GROUP_LABELS, report.filters.categoryGroup),
        report.filters.types.length ? report.filters.types.map((t) => label(TYPE_LABELS, t)).join(", ") : "All",
        report.filters.sources.length ? report.filters.sources.map((s) => label(SOURCE_LABELS, s)).join(", ") : "All",
        sectorName,
        report.filters.includeRejected ? "Included" : "Excluded",
      ]],
    ),
    section("Summary", "Key indicators"),
    kpiCards([
      { label: "Total incidents", value: num(kpis.totalIncidents), note: changeText(report) },
      {
        label: "High-risk hotspots",
        value: `${num(kpis.hotspotCells)} ${kpis.hotspotCells === 1 ? "cell" : "cells"}`,
        note: kpis.hotspotSectorNames.length ? kpis.hotspotSectorNames.join(", ") : "No cell met the hotspot rule",
        accent: kpis.hotspotCells ? chartColors.critical : undefined,
      },
      {
        label: "Patrol gap area",
        value: kpis.patrolGapAreaKm2 === null ? "Not configured" : km2(kpis.patrolGapAreaKm2),
        note: kpis.patrolGapSharePercent === null ? "Park boundary and grid needed" : `${percent(kpis.patrolGapSharePercent)} of the analysed park area`,
      },
      {
        label: "Conflict events",
        value: `${num(kpis.communityConflictReports)} · ${num(kpis.collarBreaches)}`,
        note: "Community reports · collar breaches (counted separately)",
        accent: chartColors.blue,
      },
    ]),
    section("Analysis", "Key insights"),
    report.summarySentences.length
      ? { ul: report.summarySentences.map((text) => ({ text, margin: [0, 1, 0, 2] })), fontSize: 9.5, margin: [4, 0, 0, 4] }
      : note("No additional insights for this report."),
    section("Data quality", "What the numbers include"),
    table(
      ["Measure", "Count", "What it means"],
      [
        ["Without a location", num(dataQuality.excludedNoLocation), "Counted in totals and trends; left off the map and sector cells"],
        ["Outside the park boundary", num(dataQuality.outsideBoundary), "Located, but outside every analysis cell"],
        ["Rejected reports", num(dataQuality.excludedRejected), report.filters.includeRejected ? "Included by the filter" : "Excluded from every figure"],
        ["Patrol sessions analysed", num(dataQuality.sessionsAnalyzed ?? 0), "Sessions overlapping the report period"],
        ["Sessions without a usable track", num(dataQuality.sessionsWithoutTrack), "Fewer than two valid GPS points"],
        ["GPS points dropped", num(dataQuality.droppedGpsPoints), method ? `Accuracy worse than ${method.maxPointAccuracyMeters} m` : "Accuracy below the park's limit"],
        ["Alerts without a location", num(dataQuality.alertsWithoutLocation), "Counted in totals; not assigned to a boundary stretch"],
      ],
      { widths: [150, 50, "*"], align: ["left", "right", "left"] },
    ),
  ];

  // --- incidents ----------------------------------------------------------------
  const breakdownRows = report.breakdown.slice(0, 20).map((row): TableCell[] => [
    label(TYPE_LABELS, row.type),
    row.sectorName,
    { text: row.riskLevel.charAt(0) + row.riskLevel.slice(1).toLowerCase(), color: RISK_COLORS[row.riskLevel] ?? chartColors.text, bold: true },
    num(row.count),
    percent(row.sharePercent),
  ]);
  if (report.breakdown.length > 20)
    breakdownRows.push([{ text: `+ ${report.breakdown.length - 20} more rows in the CSV export`, italics: true, color: chartColors.muted, colSpan: 5 }, "", "", "", ""]);
  const incidents: Content[] = [
    section("Incidents", "Incident frequency", true),
    note(`${num(kpis.totalIncidents)} incidents, grouped by ${report.window.bucket.toLowerCase()} (Asia/Colombo). Bars show counts; the dashed line is the period average.`),
    ...(report.trend.length
      ? [{ svg: trendChartSvg(report.trend), width: CONTENT_WIDTH } as Content, compactTrendTable(report.trend)]
      : [note("No incidents were recorded in this period.")]),
    section("Type · sector · risk", "Incident breakdown"),
    table(["Incident type", "Sector", "Risk level", "Incidents", "Share"], breakdownRows, {
      widths: [140, "*", 60, 55, 50],
      align: ["left", "left", "left", "right", "right"],
      empty: "No incidents match these filters.",
    }),
    note("Risk level comes from the incident type through the park's settings; it is not a severity recorded in the field."),
  ];

  // --- spatial ------------------------------------------------------------------
  const hotspotRows = [...report.hotspots.cells]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((cell): TableCell[] => [
      cell.sectorName ?? "Unassigned",
      num(cell.count),
      { text: `${cell.riskClass} of 5`, color: cell.riskClass >= 4 ? chartColors.critical : chartColors.text, bold: cell.riskClass >= 4 },
      cell.isHotspot ? { text: "Hotspot", bold: true, color: chartColors.critical } : "—",
    ]);
  const priorityRows = report.priorityCells.map((cell, index): TableCell[] => [
    { text: String(index + 1), bold: true, color: chartColors.critical },
    cell.sectorName ?? "Unassigned",
    `${cell.centre.latitude.toFixed(3)}, ${cell.centre.longitude.toFixed(3)}`,
    num(cell.incidents),
    cell.daysSincePatrol === null ? "Never" : `${cell.daysSincePatrol} days`,
    num(Math.round(cell.score)),
  ]);
  const spatial: Content[] = [
    keep(
      section("Spatial analysis", "Hotspot and patrol coverage map"),
      patrolGaps.configured
        ? { svg: spatialMapSvg(report), width: CONTENT_WIDTH }
        : note("Spatial analysis was not configured for this park when the report was created, so no map is available."),
      ...(patrolGaps.configured
        ? [
          legend([
            ...riskRamp.map((color, i) => ({ swatch: color, label: `Risk class ${i + 1}` })),
            { swatch: "#ffffff", outline: chartColors.critical, label: "Hotspot cell" },
            { swatch: "#e2e8f0", label: "Patrol gap" },
            { swatch: chartColors.covered, label: "Patrolled in period" },
            { swatch: "#ffffff", outline: chartColors.forestDark, label: "Sector / park boundary" },
            { swatch: "#dbeafe", outline: chartColors.blue, label: "Boundary stretch" },
            { swatch: "#ffffff", outline: chartColors.critical, label: "Priority cell (numbered rank)" },
            { swatch: chartColors.text, label: "Village" },
          ]),
          note(`Grid cells are ${num(report.hotspots.cellSizeMeters)} m. The map shows cell totals only; exact incident locations are never printed.`),
        ]
        : []),
    ),
    keep(
      section("Field priorities", "Where to patrol next"),
      table(["Rank", "Sector", "Cell centre (lat, lon)", "Incidents", "Last patrol", "Score"], priorityRows, {
        widths: [30, "*", 110, 50, 60, 45],
        align: ["center", "left", "left", "right", "right", "right"],
        empty: "No cell currently meets both the hotspot and the neglect rules.",
      }),
      note("Score = incidents × days since the last patrol (capped at 90; never patrolled counts as 90). Cell centres are rounded to about 110 m."),
    ),
    keep(
      section("Hotspots", "Busiest cells"),
      table(["Sector", "Incidents", "Risk class", "Status"], hotspotRows, {
        widths: ["*", 60, 70, 70],
        align: ["left", "right", "left", "left"],
        empty: "No located incidents fall inside the analysis grid.",
      }),
    ),
  ];

  // --- patrol coverage --------------------------------------------------------------
  const neglectDays = method?.gapNeglectDays ?? 14;
  const neglected = patrolGaps.cells.filter((c) => !c.covered && (c.daysSincePatrol === null || c.daysSincePatrol >= neglectDays)).length;
  const sectorGaps = [...patrolGaps.bySector].sort((a, b) => b.gapSharePercent - a.gapSharePercent);
  const coverage: Content[] = [
    keep(
      section("Patrol coverage", "Patrol gaps"),
      patrolGaps.configured
        ? kpiCards([
            { label: "Gap area", value: km2(patrolGaps.gapAreaKm2), note: `of ${km2(patrolGaps.parkAreaKm2)} analysed` },
            { label: "Covered area", value: km2(patrolGaps.coveredAreaKm2), note: "Valid patrol tracks in the period" },
            { label: "Neglected cells", value: num(neglected), note: `Not patrolled for ${neglectDays}+ days` },
            { label: "Sessions analysed", value: num(dataQuality.sessionsAnalyzed ?? 0), note: `${num(dataQuality.sessionsWithoutTrack)} without a usable track` },
          ])
        : note("Patrol gaps need a park boundary and analysis grid, which were not configured when this report was created."),
    ),
    ...(sectorGaps.length
      ? [
          keep(
            section("By sector", "Share of each sector not patrolled"),
            { svg: horizontalBarSvg(sectorGaps.map((s) => ({ label: s.sectorName, value: s.gapSharePercent, display: percent(s.gapSharePercent) }))), width: CONTENT_WIDTH },
          ),
          table(
            ["Sector", "Gap area", "Share of sector"],
            sectorGaps.map((s) => [s.sectorName, km2(s.gapAreaKm2), percent(s.gapSharePercent)]),
            { widths: ["*", 90, 90], align: ["left", "right", "right"] },
          ),
        ]
      : []),
    keep(
      section("Method and definitions", "How the figures are calculated"),
      note(
        method
          ? `A cell counts as patrolled when a valid GPS track passes within ${method.trackBufferMeters} m of it. Points with accuracy worse than ${method.maxPointAccuracyMeters} m are dropped, and two points are not joined when they are more than ${method.maxSegmentGapSeconds} seconds or ${num(method.maxSegmentLengthMeters)} m apart. Grid cells are ${num(method.gridCellMeters)} m; a hotspot needs at least ${method.hotspotMinCount} incidents in one cell.`
          : "A cell counts as patrolled when a valid GPS track passes within the park's track buffer. The park's settings were not stored with this older report.",
      ),
      {
        ul: [
          "Incident time is when it happened (captured time), not when it synced, so offline reports land in the right period.",
          "The previous period is the same number of days immediately before the start date.",
          "Hotspot: a grid cell in the top tenth of cells with incidents, holding at least the park's minimum count.",
          "Exports are rendered from the stored report snapshot; the SHA-256 in the footer identifies that snapshot.",
        ],
        fontSize: 8,
        color: chartColors.muted,
        margin: [4, 0, 0, 4],
      },
    ),
  ];

  // --- conflict ----------------------------------------------------------------
  const rangerReported = conflicts.series.reduce((n, p) => n + p.rangerReported, 0);
  const stretches = [...conflicts.byStretch].sort((a, b) => b.communityReports + b.collarBreaches - (a.communityReports + a.collarBreaches));
  const busiest = stretches[0];
  const villagesByStretch = new Map<string, string[]>();
  for (const s of spatialContext.settlements)
    if (s.nearestStretchId) villagesByStretch.set(s.nearestStretchId, [...(villagesByStretch.get(s.nearestStretchId) ?? []), s.name]);
  const months = [...new Set(conflicts.byStretch.flatMap((s) => s.byMonth.map((m) => m.bucketStart)))].sort().slice(-8);
  const maxMonthly = Math.max(1, ...conflicts.byStretch.flatMap((s) => s.byMonth.map((m) => m.communityReports + m.collarBreaches)));
  const tint = (total: number) => (total === 0 ? null : ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80"][Math.min(4, Math.floor((total / maxMonthly) * 4.999))]);
  const matrixRows = stretches.map((s): TableCell[] => [
    { text: s.stretchName, bold: true },
    ...months.map((month): TableCell => {
      const m = s.byMonth.find((x) => x.bucketStart === month);
      const c = m?.communityReports ?? 0;
      const b = m?.collarBreaches ?? 0;
      return { text: c + b ? `${c} / ${b}` : "–", alignment: "center", fillColor: tint(c + b), color: c + b ? chartColors.forestDark : chartColors.muted };
    }),
  ]);
  const conflict: Content[] = [
    keep(
      section("Human-wildlife conflict", "Conflict trends"),
      kpiCards([
        { label: "Community reports", value: num(kpis.communityConflictReports), note: "Villager SMS and form reports", accent: chartColors.forest },
        { label: "Collar breaches", value: num(kpis.collarBreaches), note: "Geofence alerts from collars", accent: chartColors.blue },
        { label: "Ranger-reported", value: num(rangerReported), note: "Conflict incidents from rangers", accent: chartColors.purple },
        { label: "Busiest stretch", value: busiest?.stretchName ?? "None", note: busiest ? `${num(busiest.communityReports + busiest.collarBreaches)} events` : "No boundary data" },
      ]),
      conflicts.series.length
        ? { svg: conflictChartSvg(conflicts.series), width: CONTENT_WIDTH }
        : note("No conflict activity was recorded in this period."),
      note("Sources are counted separately and are not deduplicated. One event can appear in more than one series."),
    ),
    section("Boundary stretches", "Conflict events by stretch"),
    table(
      ["Boundary stretch", "Community", "Collar", "Total", "Nearby villages"],
      stretches.map((s) => [
        { text: s.stretchName, bold: true },
        num(s.communityReports),
        num(s.collarBreaches),
        { text: num(s.communityReports + s.collarBreaches), bold: true },
        (villagesByStretch.get(s.stretchId) ?? []).join(", ") || "—",
      ]),
      { widths: [120, 55, 45, 40, "*"], align: ["left", "right", "right", "right", "left"], empty: "No defined boundary stretch had conflict events." },
    ),
    ...(months.length && stretches.length
      ? [
          keep(
            section("Recurring conflict", "Monthly events by stretch"),
            table(["Stretch", ...months.map(monthLabel)], matrixRows, {
              widths: [110, ...months.map((): "*" => "*")],
              align: ["left", ...months.map((): Align => "center")],
            }),
            note("Each cell shows community reports / collar breaches. Darker green means more events that month."),
          ),
        ]
      : []),
  ];

  return {
    pageSize: "A4",
    pageMargins: [42, 50, 42, 54],
    defaultStyle: { font: "Helvetica", fontSize: 9.5, color: "#1f2937", lineHeight: 1.15 },
    styles: {
      metaLabel: { fontSize: 7, bold: true, color: chartColors.muted, characterSpacing: 0.8 },
      metaValue: { fontSize: 10, bold: true, color: chartColors.forestDark, margin: [0, 2, 0, 0] },
    },
    header: (currentPage: number) =>
      currentPage === 1
        ? { text: "" }
        : {
            columns: [
              { text: "Wana Rakshaka · Conservation Outcome Report", fontSize: 7.5, color: chartColors.muted },
              { text: `${report.park.name}  ·  ${run.code}`, alignment: "right", fontSize: 7.5, color: chartColors.muted },
            ],
            margin: [42, 22, 42, 0],
          },
    footer: (currentPage: number, pageCount: number) => ({
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.6, lineColor: "#dce5dc" }] },
        {
          columns: [
            { text: `Snapshot SHA-256: ${snapshotHash}${report.syntheticDemo === true ? "  ·  Synthetic demo data" : ""}`, fontSize: 6.5, color: chartColors.muted },
            { width: 60, text: `Page ${currentPage} of ${pageCount}`, alignment: "right", fontSize: 7, bold: true, color: chartColors.text },
          ],
          margin: [0, 5, 0, 0],
        },
        { text: "Generated by Wana Rakshaka prototype — not an official government document.", fontSize: 6.5, color: chartColors.muted, margin: [0, 2, 0, 0] },
      ],
      margin: [42, 8, 42, 0],
    }),
    info: {
      title: "Conservation Outcome Report",
      author: "Department of Wildlife Conservation — Sri Lanka (prototype)",
      subject: `${report.park.name} ${report.filters.from} to ${report.filters.to}`,
      creator: "Wana Rakshaka prototype",
      producer: "pdfmake",
      creationDate: new Date(report.generatedAt),
      modDate: new Date(report.generatedAt),
    },
    content: [...cover, ...incidents, ...spatial, ...coverage, ...conflict],
  };
}

function renderPdf(definition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = printer.createPdfKitDocument(definition);
    document.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.end();
  });
}

export const pdfExporter: ReportExporter = {
  format: "PDF",
  mimeType: "application/pdf",
  extension: "pdf",
  async render(run: StoredRun & { report: ConservationReport }) {
    const bytes = await renderPdf(reportDefinition(run));
    const pageCount = Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    if (pageCount > MAX_PDF_PAGES)
      throw new AppError("This report is too large to export as PDF.", 413, "EXPORT_TOO_LARGE");
    return bytes;
  },
};
