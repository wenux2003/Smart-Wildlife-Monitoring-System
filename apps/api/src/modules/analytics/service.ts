import type { AnalyticsRepository } from "./repository.js";
import type { HotspotRecord, ExportAuditRecord } from "./types.js";

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  async getHotspots(parkId: string, type?: string, sinceDays?: number): Promise<HotspotRecord[]> {
    const since = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : undefined;
    return this.repo.getHotspots(parkId, type, since);
  }

  async recordExport(userId: string, exportType: string, queryParams: any): Promise<ExportAuditRecord> {
    return this.repo.logExport({ userId, exportType, queryParams });
  }
}
