-- M1 extension: never apply this unmerged migration to the shared team database.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'RANGER';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_status text NOT NULL DEFAULT 'UNRESOLVED';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_text text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_accuracy double precision;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS captured_at timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reporter_phone text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth_users(id) ON DELETE RESTRICT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS first_response_at timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS outcome_notes text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS creation_hash text;
UPDATE incidents SET captured_at = reported_at WHERE captured_at IS NULL;
ALTER TABLE incidents ALTER COLUMN captured_at SET NOT NULL;
UPDATE incidents SET source = 'COMMUNITY' WHERE reporter_id IS NULL AND creation_hash IS NULL;
UPDATE incidents SET location_status = 'MANUAL' WHERE location IS NOT NULL AND location_status = 'UNRESOLVED';

CREATE TABLE IF NOT EXISTS incident_events (
 id uuid PRIMARY KEY, incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES auth_users(id) ON DELETE RESTRICT, event_type text NOT NULL,
 old_status text, new_status text, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incident_events_incident_idx ON incident_events(incident_id, created_at);
CREATE TABLE IF NOT EXISTS incident_media (
 id uuid PRIMARY KEY, incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
 data_url text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_messages (
 id uuid PRIMARY KEY, incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
 provider_message_id text UNIQUE, phone text NOT NULL, raw_text text NOT NULL,
 location_text text NOT NULL, state text NOT NULL, creation_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_follow_ups (
 id uuid PRIMARY KEY, message_id uuid NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 text text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(), state text NOT NULL DEFAULT 'SENT'
);
CREATE TABLE IF NOT EXISTS incident_landmarks (
 id uuid PRIMARY KEY, park_id uuid NOT NULL REFERENCES parks(id) ON DELETE RESTRICT,
 name text NOT NULL, latitude double precision NOT NULL, longitude double precision NOT NULL,
 UNIQUE(park_id, name)
);
-- Approximate synthetic demo reference points; these are not GPS observations.
INSERT INTO incident_landmarks(id, park_id, name, latitude, longitude)
 SELECT '81000000-0000-4000-8000-000000000001', id, 'Galge entrance', 6.52, 81.42 FROM parks WHERE code = 'YALA'
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS camera_images (
 id uuid PRIMARY KEY, park_id uuid NOT NULL REFERENCES parks(id) ON DELETE RESTRICT,
 captured_at timestamptz NOT NULL, latitude double precision NOT NULL, longitude double precision NOT NULL,
 data_url text NOT NULL, person_flag boolean NOT NULL DEFAULT false,
 classification text NOT NULL DEFAULT 'PENDING', reviewer_id uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz, resulting_incident_id uuid REFERENCES incidents(id) ON DELETE RESTRICT,
 revision integer NOT NULL DEFAULT 1, creation_hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS camera_images_park_idx ON camera_images(park_id);
