export interface HotspotRecord {
  type: string;
  count: number;
  location: [number, number];
}

export interface ExportAuditRecord {
  id: string;
  user_id: string;
  export_type: string;
  query_params: any;
  created_at: Date;
}
