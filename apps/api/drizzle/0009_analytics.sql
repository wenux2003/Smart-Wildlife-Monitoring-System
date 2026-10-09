-- 0009_analytics.sql — M4 analytics and export. Idempotent.

-- 1. Park boundary: the denominator for patrol-gap area.
ALTER TABLE parks ADD COLUMN IF NOT EXISTS boundary geometry(MultiPolygon, 4326);
CREATE INDEX IF NOT EXISTS parks_boundary_gix ON parks USING GIST (boundary);

-- 2. Named analysis areas: interior sectors and boundary stretches.
CREATE TABLE IF NOT EXISTS analysis_sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id     uuid NOT NULL REFERENCES parks(id) ON DELETE RESTRICT,
  code        varchar(32)  NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  name        varchar(120) NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('SECTOR', 'BOUNDARY_STRETCH')),
  area        geometry(MultiPolygon, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (park_id, code)
);
CREATE INDEX IF NOT EXISTS analysis_sectors_park_kind_idx ON analysis_sectors (park_id, kind);
CREATE INDEX IF NOT EXISTS analysis_sectors_area_gix ON analysis_sectors USING GIST (area);

-- 3. Precomputed equal-area grid per park (metric, UTM 44N = EPSG:32644).
CREATE TABLE IF NOT EXISTS analysis_grid_cells (
  park_id      uuid NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  cell_size_m  integer NOT NULL CHECK (cell_size_m BETWEEN 250 AND 5000),
  col          integer NOT NULL,
  row          integer NOT NULL,
  sector_id    uuid REFERENCES analysis_sectors(id) ON DELETE SET NULL,
  geom         geometry(Polygon, 4326)  NOT NULL,
  geom_m       geometry(Polygon, 32644) NOT NULL,
  area_m2      double precision NOT NULL CHECK (area_m2 > 0),
  PRIMARY KEY (park_id, cell_size_m, col, row)
);
CREATE INDEX IF NOT EXISTS analysis_grid_cells_geom_gix ON analysis_grid_cells USING GIST (geom);
CREATE INDEX IF NOT EXISTS analysis_grid_cells_geom_m_gix ON analysis_grid_cells USING GIST (geom_m);

-- 4. Report runs: the audit log and the snapshot each export is rendered from.
CREATE SEQUENCE IF NOT EXISTS report_run_number_seq;
CREATE TABLE IF NOT EXISTS report_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             varchar(40) NOT NULL UNIQUE,
  park_id          uuid NOT NULL REFERENCES parks(id) ON DELETE RESTRICT,
  requested_by     uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  requester_role   text NOT NULL,
  filters          jsonb NOT NULL,
  status           text NOT NULL CHECK (status IN ('SUCCEEDED', 'EMPTY', 'TIMED_OUT', 'FAILED')),
  snapshot         jsonb,
  snapshot_sha256  char(64),
  duration_ms      integer NOT NULL CHECK (duration_ms >= 0),
  error_code       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'SUCCEEDED') = (snapshot IS NOT NULL AND snapshot_sha256 IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS report_runs_park_created_idx ON report_runs (park_id, created_at DESC);
CREATE INDEX IF NOT EXISTS report_runs_user_created_idx ON report_runs (requested_by, created_at DESC);

-- 5. Exports: one row per attempt, including failures.
CREATE TABLE IF NOT EXISTS report_exports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
  requested_by  uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  format        text NOT NULL CHECK (format IN ('PDF', 'CSV')),
  status        text NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED')),
  byte_size     integer CHECK (byte_size IS NULL OR byte_size > 0),
  file_sha256   char(64),
  error_code    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'SUCCEEDED') = (byte_size IS NOT NULL AND file_sha256 IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS report_exports_run_idx ON report_exports (run_id, created_at DESC);

-- 6. Read-path indexes on other modules' tables (additive only).
CREATE INDEX IF NOT EXISTS incidents_park_captured_idx ON incidents (park_id, captured_at);
CREATE INDEX IF NOT EXISTS incidents_location_gix ON incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS alerts_park_type_created_idx ON alerts (park_id, type, created_at);
