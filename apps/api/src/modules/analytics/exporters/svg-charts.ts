import type { ConservationReport } from "@wr/shared";

/** Same palette as the Ops analytics pages (plan §11.2), so the PDF reads like the screen. */
export const chartColors = {
  forest: "#166534",
  forestDark: "#14352b",
  blue: "#1d4ed8",
  purple: "#7c3aed",
  gap: "#94a3b8",
  covered: "#dcfce7",
  text: "#334155",
  muted: "#64748b",
  grid: "#e5ece5",
  axis: "#cbd5e1",
  critical: "#b91c1c",
};
export const riskRamp = ["#fef3c7", "#fcd34d", "#f59e0b", "#d97706", "#b91c1c"];

const FONT = "Helvetica,Arial,sans-serif";

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function svg(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>text{font:10px ${FONT};fill:${chartColors.text}}</style>${body}</svg>`;
}

/** Round the axis maximum up to a readable value and return evenly spaced ticks. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

type Frame = { left: number; top: number; plotWidth: number; plotHeight: number; scaleY: (v: number) => number; axis: string };

/** Axes with horizontal grid lines and value ticks shared by the column charts. */
function columnFrame(width: number, height: number, max: number, offsetTop: number): Frame {
  const left = 44;
  const right = 14;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - offsetTop - bottom;
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  const scaleY = (v: number) => offsetTop + plotHeight - (v / top) * plotHeight;
  const axis = ticks
    .map((tick) => {
      const y = scaleY(tick).toFixed(2);
      return `<path d="M${left} ${y}H${width - right}" stroke="${tick === 0 ? chartColors.axis : chartColors.grid}" stroke-width="1"${tick === 0 ? "" : ' stroke-dasharray="3 3"'}/><text x="${left - 8}" y="${(Number(y) + 3).toFixed(2)}" text-anchor="end" fill="${chartColors.muted}">${tick}</text>`;
    })
    .join("");
  return { left, top: offsetTop, plotWidth, plotHeight, scaleY, axis };
}

function xLabels(labels: string[], left: number, step: number, y: number): string {
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return labels
    .map((label, index) =>
      index % every === 0 || index === labels.length - 1
        ? `<text x="${(left + index * step + step / 2).toFixed(2)}" y="${y}" text-anchor="middle" fill="${chartColors.muted}">${escapeXml(label)}</text>`
        : "",
    )
    .join("");
}

export function trendChartSvg(points: ConservationReport["trend"]): string {
  const width = 680;
  const height = 240;
  const max = Math.max(1, ...points.map((p) => p.count));
  const frame = columnFrame(width, height, max, 26);
  const step = points.length ? frame.plotWidth / points.length : frame.plotWidth;
  const barWidth = Math.max(3, Math.min(34, step * 0.62));
  const showValues = points.length <= 31;
  const bars = points
    .map((point, index) => {
      const x = frame.left + index * step + (step - barWidth) / 2;
      const y = frame.scaleY(point.count);
      const h = frame.scaleY(0) - y;
      const value = showValues && point.count > 0
        ? `<text x="${(x + barWidth / 2).toFixed(2)}" y="${(y - 4).toFixed(2)}" text-anchor="middle" font-weight="bold" fill="${chartColors.forestDark}">${point.count}</text>`
        : "";
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0, h).toFixed(2)}" rx="3" fill="${chartColors.forest}"><title>${escapeXml(point.label)}: ${point.count}</title></rect>${value}`;
    })
    .join("");
  const mean = points.length ? points.reduce((n, p) => n + p.count, 0) / points.length : 0;
  const meanY = frame.scaleY(mean).toFixed(2);
  const meanLine = mean > 0
    ? `<path d="M${frame.left} ${meanY}H${width - 14}" stroke="${chartColors.purple}" stroke-width="1.2" stroke-dasharray="6 4"/><path d="M${width - 112} 6H${width - 92}" stroke="${chartColors.purple}" stroke-width="1.2" stroke-dasharray="6 4"/><text x="${width - 88}" y="9" fill="${chartColors.purple}">average ${mean.toFixed(1)}</text>`
    : "";
  return svg(width, height, frame.axis + bars + meanLine + xLabels(points.map((p) => p.label), frame.left, step, height - 14));
}

export function conflictChartSvg(points: ConservationReport["conflicts"]["series"]): string {
  const width = 680;
  const height = 205;
  const series = [
    { key: "communityReports", label: "Community reports", color: chartColors.forest },
    { key: "collarBreaches", label: "Collar breaches", color: chartColors.blue },
    { key: "rangerReported", label: "Ranger-reported", color: chartColors.purple },
  ] as const;
  const max = Math.max(1, ...points.flatMap((p) => series.map((s) => p[s.key])));
  const frame = columnFrame(width, height, max, 30);
  const step = points.length ? frame.plotWidth / points.length : frame.plotWidth;
  const barWidth = Math.max(3, Math.min(26, (step * 0.7) / series.length));
  const bars = points
    .map((point, index) => {
      const groupWidth = barWidth * series.length + 2 * (series.length - 1);
      const start = frame.left + index * step + (step - groupWidth) / 2;
      return series
        .map(({ key, color }, s) => {
          const value = point[key];
          const x = start + s * (barWidth + 2);
          const y = frame.scaleY(value);
          const label = value > 0 && points.length <= 12
            ? `<text x="${(x + barWidth / 2).toFixed(2)}" y="${(y - 3).toFixed(2)}" text-anchor="middle" font-size="8" fill="${color}">${value}</text>`
            : "";
          return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0, frame.scaleY(0) - y).toFixed(2)}" rx="2" fill="${color}"><title>${escapeXml(point.label)}: ${value}</title></rect>${label}`;
        })
        .join("");
    })
    .join("");
  const legend = series
    .map((s, i) => `<rect x="${frame.left + i * 150}" y="4" width="10" height="10" rx="2" fill="${s.color}"/><text x="${frame.left + 15 + i * 150}" y="13">${s.label}</text>`)
    .join("");
  return svg(width, height, legend + frame.axis + bars + xLabels(points.map((p) => p.label), frame.left, step, height - 14));
}

/** Horizontal bars, one per row, with the value written at the end of each bar. */
export function horizontalBarSvg(rows: { label: string; value: number; display: string }[], max = 100): string {
  const width = 680;
  const rowHeight = 24;
  const labelWidth = 170;
  const right = 70;
  const height = Math.max(1, rows.length) * rowHeight + 8;
  const plotWidth = width - labelWidth - right;
  const body = rows
    .map((row, index) => {
      const y = 4 + index * rowHeight;
      const w = max > 0 ? (Math.min(row.value, max) / max) * plotWidth : 0;
      return `<text x="${labelWidth - 10}" y="${y + 15}" text-anchor="end">${escapeXml(row.label)}</text><rect x="${labelWidth}" y="${y + 4}" width="${plotWidth}" height="14" rx="3" fill="${chartColors.grid}"/><rect x="${labelWidth}" y="${y + 4}" width="${w.toFixed(2)}" height="14" rx="3" fill="${chartColors.gap}"><title>${escapeXml(row.label)}: ${escapeXml(row.display)}</title></rect><text x="${(labelWidth + plotWidth + 8).toFixed(2)}" y="${y + 15}" font-weight="bold">${escapeXml(row.display)}</text>`;
    })
    .join("");
  return svg(width, height, rows.length ? body : `<text x="0" y="16">No sectors are configured.</text>`);
}

type LonLat = { longitude: number; latitude: number };

/**
 * Cell-level spatial overview: boundary, sectors, boundary stretches, settlements, patrol coverage,
 * hotspot classes and numbered priority cells. Never draws individual incident points.
 */
export function spatialMapSvg(report: ConservationReport): string {
  const width = 680;
  const height = 430;
  const padding = 22;
  const context = report.spatialContext;
  const footprint: LonLat[][] = report.patrolGaps.cells.length
    ? report.patrolGaps.cells.map((c) => c.polygon)
    : report.hotspots.cells.map((c) => c.polygon);
  const boundaryRings = (context.parkBoundary ?? []).flatMap((polygon) => polygon);
  const stretchRings = context.sectors.filter((s) => s.kind === "BOUNDARY_STRETCH").flatMap((s) => s.polygon.flat());
  const all = [...footprint.flat(), ...boundaryRings.flat(), ...stretchRings.flat()];
  if (!footprint.length)
    return svg(width, 60, `<text x="0" y="30" font-size="13">No spatial cells are available for this report.</text>`);

  const minX = Math.min(...all.map((p) => p.longitude));
  const maxX = Math.max(...all.map((p) => p.longitude));
  const minY = Math.min(...all.map((p) => p.latitude));
  const maxY = Math.max(...all.map((p) => p.latitude));
  const scale = Math.min((width - padding * 2) / Math.max(1e-9, maxX - minX), (height - padding * 2 - 16) / Math.max(1e-9, maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - 16 - (maxY - minY) * scale) / 2;
  const project = (p: LonLat) => ({ x: offsetX + (p.longitude - minX) * scale, y: height - 16 - offsetY - (p.latitude - minY) * scale });
  const points = (ring: LonLat[]) => ring.map((p) => { const q = project(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");
  /** Projected bounding box of a ring. */
  const box = (ring: LonLat[]) => {
    const xs = ring.map((p) => project(p).x);
    const ys = ring.map((p) => project(p).y);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  };
  const park = box(footprint.flat());
  /** Stretch labels go on the outer side of the band (outside the park) so they never cover sector names. */
  const stretchLabel = (ring: LonLat[], name: string) => {
    const b = box(ring);
    const cx = (b.left + b.right) / 2;
    const cy = (b.top + b.bottom) / 2;
    const textWidth = name.length * 4.4; // ~8 pt Helvetica
    const above = { x: cx, y: b.top - 4, anchor: "middle" };
    const below = { x: cx, y: b.bottom + 10, anchor: "middle" };
    const dx = (cx - (park.left + park.right) / 2) / Math.max(1, park.right - park.left);
    const dy = (cy - (park.top + park.bottom) / 2) / Math.max(1, park.bottom - park.top);
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) return b.left - 4 - textWidth >= 2 ? { x: b.left - 4, y: cy, anchor: "end" } : b.top > 14 ? above : below;
      return b.right + 4 + textWidth <= width - 2 ? { x: b.right + 4, y: cy, anchor: "start" } : b.top > 14 ? above : below;
    }
    return dy < 0 && b.top > 14 ? above : below;
  };

  const coverage = report.patrolGaps.cells
    .map((c) => `<polygon points="${points(c.polygon)}" fill="${c.covered ? chartColors.covered : "#e2e8f0"}" stroke="#ffffff" stroke-width="0.4"/>`)
    .join("");
  const hotspots = report.hotspots.cells
    .map((c) => `<polygon points="${points(c.polygon)}" fill="${riskRamp[c.riskClass - 1]}" stroke="${c.isHotspot ? chartColors.critical : "#78716c"}" stroke-width="${c.isHotspot ? 1.4 : 0.5}"><title>${c.count} incidents, risk class ${c.riskClass}</title></polygon>`)
    .join("");
  const stretches = context.sectors
    .filter((s) => s.kind === "BOUNDARY_STRETCH")
    .map((s) => {
      const ring = s.polygon[0]?.[0] ?? [];
      const l = stretchLabel(ring, s.name);
      return `<polygon points="${points(ring)}" fill="${chartColors.blue}" fill-opacity="0.08" stroke="${chartColors.blue}" stroke-width="1" stroke-dasharray="4 3"/><text x="${l.x.toFixed(1)}" y="${(l.y + 3).toFixed(1)}" text-anchor="${l.anchor}" font-size="8" font-style="italic" fill="${chartColors.blue}">${escapeXml(s.name)}</text>`;
    })
    .join("");
  // Sector names sit in each sector's top-left corner, away from the cells in its middle.
  const sectors = context.sectors
    .filter((s) => s.kind === "SECTOR")
    .map((s) => {
      const ring = s.polygon[0]?.[0] ?? [];
      const b = box(ring);
      return `<polygon points="${points(ring)}" fill="none" stroke="${chartColors.forestDark}" stroke-width="0.9" stroke-opacity="0.7"/><text x="${(b.left + 4).toFixed(1)}" y="${(b.top + 11).toFixed(1)}" font-size="8.5" font-weight="bold" fill="${chartColors.forestDark}">${escapeXml(s.name)}</text>`;
    })
    .join("");
  const boundary = boundaryRings
    .map((ring) => `<polygon points="${points(ring)}" fill="none" stroke="${chartColors.forestDark}" stroke-width="2.4"/>`)
    .join("");
  const outline = boundary || gridOutline(footprint, project);
  const settlements = context.settlements
    // Villages are dots only; their names are listed against each boundary stretch in the conflict table.
    .map((s) => { const p = project(s.location); return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.8" fill="${chartColors.text}" stroke="#ffffff" stroke-width="0.8"/>`; })
    .join("");
  const priority = report.priorityCells
    .map((cell, index) => { const p = project(cell.centre); return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="#ffffff" stroke="${chartColors.critical}" stroke-width="2.2"/><text x="${p.x.toFixed(1)}" y="${(p.y + 3.8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="${chartColors.critical}">${index + 1}</text>`; })
    .reverse() // draw rank 1 last so it stays on top where markers overlap
    .join("");
  const caption = `${boundary ? "Approximate park boundary" : "Grid-derived boundary"} · cell-level aggregates only · no incident points shown`;
  return svg(
    width,
    height,
    
      coverage + stretches + hotspots + sectors + outline + settlements + priority +
      `<text x="${padding}" y="${height - 3}" font-size="9" fill="${chartColors.muted}">${caption}</text>`,
  );
}

/** Outer edges of the grid when the park has no stored boundary (edges used by exactly one cell). */
function gridOutline(footprint: LonLat[][], project: (p: LonLat) => { x: number; y: number }): string {
  const edges = new Map<string, { start: LonLat; end: LonLat; count: number }>();
  for (const polygon of footprint)
    for (let i = 0; i < polygon.length; i++) {
      const start = polygon[i]!;
      const end = polygon[(i + 1) % polygon.length]!;
      const a = `${start.longitude.toFixed(7)},${start.latitude.toFixed(7)}`;
      const b = `${end.longitude.toFixed(7)},${end.latitude.toFixed(7)}`;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, { start, end, count: 1 });
    }
  const d = [...edges.values()]
    .filter((e) => e.count === 1)
    .map((e) => { const s = project(e.start); const t = project(e.end); return `M${s.x.toFixed(1)},${s.y.toFixed(1)}L${t.x.toFixed(1)},${t.y.toFixed(1)}`; })
    .join("");
  return `<path d="${d}" fill="none" stroke="${chartColors.forestDark}" stroke-width="2.2"/>`;
}
