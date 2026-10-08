-- M3: Alert Extensions (Camera Traps, Ranger Locations, Resolution, Broadcast)

CREATE TABLE IF NOT EXISTS camera_traps (
  id uuid PRIMARY KEY,
  park_id uuid NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  location geometry(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS camera_traps_location_idx ON camera_traps USING gist(location);

CREATE TABLE IF NOT EXISTS ranger_locations (
  ranger_id uuid PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  location geometry(Point, 4326) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ranger_locations_location_idx ON ranger_locations USING gist(location);

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolution_reason text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;
