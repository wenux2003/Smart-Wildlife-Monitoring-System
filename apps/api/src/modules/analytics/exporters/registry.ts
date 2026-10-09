import type { ReportFormat, ReportExporter } from "../types.js";

export class ExporterRegistry {
  private readonly exporters: ReadonlyMap<ReportFormat, ReportExporter>;

  constructor(exporters: readonly ReportExporter[]) {
    const entries = exporters.map(
      (exporter) => [exporter.format, exporter] as const,
    );
    if (new Set(entries.map(([format]) => format)).size !== entries.length)
      throw new Error("Each report format must have exactly one exporter.");
    this.exporters = new Map(entries);
  }

  get(format: ReportFormat): ReportExporter | undefined {
    return this.exporters.get(format);
  }
}
