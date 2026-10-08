import { sql } from "drizzle-orm";
import {
  char,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";
import { parks } from "./reference-schema.js";

const geometry = customType<{
  data: string;
  config: { type: string; srid?: number };
}>({
  dataType(config) {
    return `geometry(${config?.type ?? "Geometry"},${config?.srid ?? 4326})`;
  },
});

export const reportRunNumberSeq = pgSequence("report_run_number_seq");

export const analysisSectors = pgTable(
  "analysis_sectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parkId: uuid("park_id")
      .notNull()
      .references(() => parks.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    kind: text("kind").notNull(),
    area: geometry("area", { type: "MultiPolygon" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("analysis_sectors_park_code_unique").on(table.parkId, table.code),
    index("analysis_sectors_park_kind_idx").on(table.parkId, table.kind),
    index("analysis_sectors_area_gix").using("gist", table.area),
    check(
      "analysis_sectors_code_check",
      sql`${table.code} ~ '^[A-Z][A-Z0-9_]*$'`,
    ),
    check(
      "analysis_sectors_kind_check",
      sql`${table.kind} IN ('SECTOR', 'BOUNDARY_STRETCH')`,
    ),
  ],
);

export const analysisGridCells = pgTable(
  "analysis_grid_cells",
  {
    parkId: uuid("park_id")
      .notNull()
      .references(() => parks.id, { onDelete: "cascade" }),
    cellSizeM: integer("cell_size_m").notNull(),
    col: integer("col").notNull(),
    row: integer("row").notNull(),
    sectorId: uuid("sector_id").references(() => analysisSectors.id, {
      onDelete: "set null",
    }),
    geom: geometry("geom", { type: "Polygon" }).notNull(),
    geomM: geometry("geom_m", { type: "Polygon", srid: 32644 }).notNull(),
    areaM2: doublePrecision("area_m2").notNull(),
  },
  (table) => [
    primaryKey({
      name: "analysis_grid_cells_pkey",
      columns: [table.parkId, table.cellSizeM, table.col, table.row],
    }),
    index("analysis_grid_cells_geom_gix").using("gist", table.geom),
    index("analysis_grid_cells_geom_m_gix").using("gist", table.geomM),
    check(
      "analysis_grid_cells_cell_size_m_check",
      sql`${table.cellSizeM} BETWEEN 250 AND 5000`,
    ),
    check("analysis_grid_cells_area_m2_check", sql`${table.areaM2} > 0`),
  ],
);

export const reportRuns = pgTable(
  "report_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 40 }).notNull().unique(),
    parkId: uuid("park_id")
      .notNull()
      .references(() => parks.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    requesterRole: text("requester_role").notNull(),
    filters: jsonb("filters").notNull(),
    status: text("status").notNull(),
    snapshot: jsonb("snapshot"),
    snapshotSha256: char("snapshot_sha256", { length: 64 }),
    durationMs: integer("duration_ms").notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("report_runs_park_created_idx").on(table.parkId, table.createdAt),
    index("report_runs_user_created_idx").on(table.requestedBy, table.createdAt),
    check(
      "report_runs_status_check",
      sql`${table.status} IN ('SUCCEEDED', 'EMPTY', 'TIMED_OUT', 'FAILED')`,
    ),
    check("report_runs_duration_ms_check", sql`${table.durationMs} >= 0`),
    check(
      "report_runs_snapshot_check",
      sql`(${table.status} = 'SUCCEEDED') = (${table.snapshot} IS NOT NULL AND ${table.snapshotSha256} IS NOT NULL)`,
    ),
  ],
);

export const reportExports = pgTable(
  "report_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => reportRuns.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    format: text("format").notNull(),
    status: text("status").notNull(),
    byteSize: integer("byte_size"),
    fileSha256: char("file_sha256", { length: 64 }),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("report_exports_run_idx").on(table.runId, table.createdAt),
    check(
      "report_exports_format_check",
      sql`${table.format} IN ('PDF', 'CSV')`,
    ),
    check(
      "report_exports_status_check",
      sql`${table.status} IN ('SUCCEEDED', 'FAILED')`,
    ),
    check(
      "report_exports_byte_size_check",
      sql`${table.byteSize} IS NULL OR ${table.byteSize} > 0`,
    ),
    check(
      "report_exports_integrity_check",
      sql`(${table.status} = 'SUCCEEDED') = (${table.byteSize} IS NOT NULL AND ${table.fileSha256} IS NOT NULL)`,
    ),
  ],
);
