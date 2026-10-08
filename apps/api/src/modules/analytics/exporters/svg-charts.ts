import type { ConservationReport } from "@wr/shared";

const colors = {
  forest: "#166534",
  blue: "#1d4ed8",
  purple: "#7c3aed",
  gap: "#94a3b8",
  text: "#334155",
  grid: "#dce5dc",
};

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function trendChartSvg(points: ConservationReport["trend"]): string {
  const width = 680;
  const height = 250;
  const left = 42;
  const right = 12;
  const top = 18;
  const bottom = 42;
  const max = Math.max(1, ...points.map((point) => point.count));
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const step = points.length ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(2, Math.min(24, step * 0.68));
  const bars = points
    .map((point, index) => {
      const barHeight = (point.count / max) * plotHeight;
      const x = left + index * step + (step - barWidth) / 2;
      const y = top + plotHeight - barHeight;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="2" fill="${colors.forest}"/><title>${escapeXml(point.label)}: ${point.count}</title>`;
    })
    .join("");
  const labels = points
    .filter(
      (_, index) =>
        index === 0 ||
        index === points.length - 1 ||
        index % Math.ceil(points.length / 6) === 0,
    )
    .map((point) => {
      const index = points.indexOf(point);
      const x = left + index * step + step / 2;
      return `<text x="${x.toFixed(2)}" y="${height - 12}" text-anchor="middle">${escapeXml(point.label)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>text{font:10px Helvetica,Arial,sans-serif;fill:${colors.text}}</style><path d="M${left} ${top}V${height - bottom}H${width - right}" fill="none" stroke="${colors.grid}"/>${bars}${labels}</svg>`;
}

export function conflictChartSvg(
  points: ConservationReport["conflicts"]["series"],
): string {
  const width = 680;
  const height = 230;
  const left = 42;
  const right = 12;
  const top = 24;
  const bottom = 42;
  const max = Math.max(
    1,
    ...points.flatMap((point) => [
      point.communityReports,
      point.collarBreaches,
      point.rangerReported,
    ]),
  );
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const step = points.length ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(2, Math.min(10, step * 0.18));
  const series = [
    { key: "communityReports", color: colors.forest },
    { key: "collarBreaches", color: colors.blue },
    { key: "rangerReported", color: colors.purple },
  ] as const;
  const bars = points
    .map((point, index) => {
      const groupWidth = barWidth * series.length + 4;
      const start = left + index * step + (step - groupWidth) / 2;
      return series
        .map(({ key, color }, seriesIndex) => {
          const amount = point[key];
          const barHeight = (amount / max) * plotHeight;
          return `<rect x="${(start + seriesIndex * (barWidth + 2)).toFixed(2)}" y="${(top + plotHeight - barHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" fill="${color}"><title>${escapeXml(point.label)}: ${amount}</title></rect>`;
        })
        .join("");
    })
    .join("");
  const labels = points
    .filter(
      (_, index) =>
        index === 0 ||
        index === points.length - 1 ||
        index % Math.ceil(points.length / 6) === 0,
    )
    .map((point) => {
      const index = points.indexOf(point);
      const x = left + index * step + step / 2;
      return `<text x="${x.toFixed(2)}" y="${height - 12}" text-anchor="middle">${escapeXml(point.label)}</text>`;
    })
    .join("");
  const legend = [
    ["Community", colors.forest],
    ["Collar breach", colors.blue],
    ["Ranger reported", colors.purple],
  ]
    .map(
      ([label, color], index) =>
        `<rect x="${left + index * 160}" y="5" width="9" height="9" fill="${color}"/><text x="${left + 13 + index * 160}" y="14">${label}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>text{font:10px Helvetica,Arial,sans-serif;fill:${colors.text}}</style>${legend}<path d="M${left} ${top}V${height - bottom}H${width - right}" fill="none" stroke="${colors.grid}"/>${bars}${labels}</svg>`;
}

export function spatialMapSvg(report: ConservationReport): string {
  const width = 680;
  const height = 320;
  const padding = 18;
  const cells = [
    ...report.hotspots.cells.map((cell) => ({
      polygon: cell.polygon,
      fill: ["#fef3c7", "#fcd34d", "#f59e0b", "#d97706", "#b91c1c"][
        cell.riskClass - 1
      ],
      label: `${cell.count} incidents, risk class ${cell.riskClass}`,
    })),
    ...report.patrolGaps.cells
      .filter((cell) => !cell.covered)
      .map((cell) => ({
        polygon: cell.polygon,
        fill: "url(#gap)",
        label: "Patrol coverage gap",
      })),
  ];
  const footprint = report.patrolGaps.cells.length
    ? report.patrolGaps.cells.map((cell) => cell.polygon)
    : report.hotspots.cells.map((cell) => cell.polygon);
  const all = footprint.flat();
  if (!all.length)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="24" y="36" font-family="Helvetica,Arial,sans-serif" font-size="14" fill="${colors.text}">No spatial cells are available for this report.</text></svg>`;
  const bounds = all.reduce(
    (result, point) => ({
      minX: Math.min(result.minX, point.longitude),
      maxX: Math.max(result.maxX, point.longitude),
      minY: Math.min(result.minY, point.latitude),
      maxY: Math.max(result.maxY, point.latitude),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const { minX, maxX, minY, maxY } = bounds;
  const scaleX = (width - padding * 2) / Math.max(1e-9, maxX - minX);
  const scaleY = (height - padding * 2) / Math.max(1e-9, maxY - minY);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const project = (point: { longitude: number; latitude: number }) => ({
    x: offsetX + (point.longitude - minX) * scale,
    y: height - offsetY - (point.latitude - minY) * scale,
  });
  const shapes = cells
    .map((cell) => {
      const points = cell.polygon
        .map((point) => {
          const projected = project(point);
          return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
        })
        .join(" ");
      return `<polygon points="${points}" fill="${cell.fill}" stroke="#475569" stroke-width="0.7"><title>${cell.label}</title></polygon>`;
    })
    .join("");
  const edges = new Map<
    string,
    {
      start: (typeof all)[number];
      end: (typeof all)[number];
      count: number;
    }
  >();
  for (const polygon of footprint)
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const startKey = `${start.longitude.toFixed(7)},${start.latitude.toFixed(7)}`;
      const endKey = `${end.longitude.toFixed(7)},${end.latitude.toFixed(7)}`;
      const key =
        startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, { start, end, count: 1 });
    }
  const outline = [...edges.values()]
    .filter((edge) => edge.count === 1)
    .map((edge) => {
      const start = project(edge.start);
      const end = project(edge.end);
      return `M${start.x.toFixed(2)},${start.y.toFixed(2)}L${end.x.toFixed(2)},${end.y.toFixed(2)}`;
    })
    .join("");
  const legend = [
    ["1", "#fef3c7"],
    ["2", "#fcd34d"],
    ["3", "#f59e0b"],
    ["4", "#d97706"],
    ["5", "#b91c1c"],
    ["Gap", "url(#gap)"],
  ]
    .map(
      ([label, fill], index) =>
        `<rect x="${width - 150 + (index % 3) * 46}" y="${12 + Math.floor(index / 3) * 20}" width="12" height="12" fill="${fill}" stroke="#475569"/><text x="${width - 134 + (index % 3) * 46}" y="${22 + Math.floor(index / 3) * 20}">${label}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="gap" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#e2e8f0"/><path d="M0 0V6" stroke="${colors.gap}" stroke-width="2"/></pattern></defs>${shapes}<path d="${outline}" fill="none" stroke="#14352b" stroke-width="2.2"/><rect x="${width - 158}" y="5" width="154" height="50" rx="4" fill="white" fill-opacity="0.9" stroke="${colors.grid}"/>${legend}<text x="${padding}" y="${height - 4}" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="${colors.text}">Grid-derived boundary · cell-level aggregates only · no incident points shown</text></svg>`;
}
