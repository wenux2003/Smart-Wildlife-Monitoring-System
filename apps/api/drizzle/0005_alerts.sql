-- M3: Monitor Wildlife & Collar Alerts
CREATE TABLE IF NOT EXISTS collars (
  id uuid PRIMARY KEY,
  park_id uuid NOT NULL REFERENCES parks(id) ON DELETE RESTRICT,
  animal_name varchar(100),
  species varchar(100),
  latest_battery double precision,
  status text,
  last_ping_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collar_pings (
  id uuid PRIMARY KEY,
  collar_id uuid NOT NULL REFERENCES collars(id) ON DELETE CASCADE,
  location geometry(Point, 4326) NOT NULL,
  speed double precision,
  battery double precision,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collar_pings_collar_recorded_idx ON collar_pings(collar_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS collar_pings_location_idx ON collar_pings USING gist(location);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY,
  park_id uuid NOT NULL REFERENCES parks(id) ON DELETE RESTRICT,
  collar_id uuid REFERENCES collars(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('GEOFENCE_BREACH', 'IMMOBILITY', 'SIGNAL_LOST', 'LOW_BATTERY')),
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'DISPATCHED', 'ACCEPTED', 'ON_SCENE', 'RESOLVED', 'CANCELLED', 'AUTO_RESOLVED')),
  location geometry(Point, 4326),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS alerts_park_status_idx ON alerts(park_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_location_idx ON alerts USING gist(location);

CREATE TABLE IF NOT EXISTS alert_dispatches (
  id uuid PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  ranger_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'ARRIVED', 'DONE', 'CANCELLED')),
  notes text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  sent_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS alert_dispatches_alert_status_idx ON alert_dispatches(alert_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS alert_dispatches_one_open_per_alert ON alert_dispatches(alert_id) WHERE status IN ('PENDING', 'ACCEPTED', 'ARRIVED');

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY,
  park_id uuid NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  location geometry(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settlements_location_idx ON settlements USING gist(location);
