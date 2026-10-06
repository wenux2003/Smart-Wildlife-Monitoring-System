-- Ranger patrol routes, assignments and sessions (M2).
-- Coordinates use SRID 4326 with longitude/latitude ordering.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS patrol_routes (
  id uuid PRIMARY KEY,
  park_id uuid NOT NULL REFERENCES parks(id) ON DELETE RESTRICT,
  code varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  sector varchar(120) NOT NULL,
  description text NOT NULL DEFAULT '',
  route_geometry geometry(LineString, 4326),
  target_area geometry(Polygon, 4326),
  estimated_distance_m integer NOT NULL CHECK (estimated_distance_m > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (park_id, code)
);

CREATE INDEX IF NOT EXISTS patrol_routes_park_active_idx
  ON patrol_routes(park_id, active);
CREATE INDEX IF NOT EXISTS patrol_routes_geometry_idx
  ON patrol_routes USING gist(route_geometry);

CREATE TABLE IF NOT EXISTS patrol_assignments (
  id uuid PRIMARY KEY,
  route_id uuid NOT NULL REFERENCES patrol_routes(id) ON DELETE RESTRICT,
  route_version integer NOT NULL CHECK (route_version > 0),
  ranger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ASSIGNED' CHECK (
    status IN ('ASSIGNED', 'ACTIVE', 'COMPLETED', 'PARTIAL', 'CANCELLED')
  ),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patrol_assignments_ranger_status_idx
  ON patrol_assignments(ranger_id, status, assigned_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS patrol_assignments_one_active_ranger
  ON patrol_assignments(ranger_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS patrol_sessions (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL UNIQUE REFERENCES patrol_assignments(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'PARTIAL')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  termination_reason text,
  distance_m double precision NOT NULL DEFAULT 0 CHECK (distance_m >= 0),
  coverage_percent double precision NOT NULL DEFAULT 0 CHECK (
    coverage_percent >= 0 AND coverage_percent <= 100
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'ACTIVE' AND ended_at IS NULL)
    OR (status IN ('COMPLETED', 'PARTIAL') AND ended_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS patrol_sessions_status_idx
  ON patrol_sessions(status, started_at DESC);
