-- Idempotent child records received from offline Ranger patrol clients.
CREATE TABLE IF NOT EXISTS patrol_gps_points (
  client_record_id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES patrol_sessions(id) ON DELETE CASCADE,
  position geometry(Point, 4326) NOT NULL,
  accuracy_m double precision CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patrol_gps_points_session_time_idx
  ON patrol_gps_points(session_id, recorded_at);
CREATE INDEX IF NOT EXISTS patrol_gps_points_position_idx
  ON patrol_gps_points USING gist(position);

CREATE TABLE IF NOT EXISTS patrol_waypoints (
  client_record_id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES patrol_sessions(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN ('WILDLIFE_SIGN', 'HAZARD_SNARE', 'TRAIL_MARKER', 'OTHER')
  ),
  note varchar(500) NOT NULL DEFAULT '',
  photo_name varchar(255),
  position geometry(Point, 4326) NOT NULL,
  accuracy_m double precision CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patrol_waypoints_session_time_idx
  ON patrol_waypoints(session_id, observed_at);
CREATE INDEX IF NOT EXISTS patrol_waypoints_position_idx
  ON patrol_waypoints USING gist(position);
