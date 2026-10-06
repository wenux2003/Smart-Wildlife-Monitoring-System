-- Parks and the Super Admin -> Park Manager -> staff account hierarchy.
-- Idempotent: safe to run again. See docs/User_groups.md section 2.
CREATE TABLE IF NOT EXISTS parks (
  id uuid PRIMARY KEY,
  code varchar(32) NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  name varchar(120) NOT NULL,
  terrain text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_role_check;
ALTER TABLE auth_users ADD CONSTRAINT auth_users_role_check
  CHECK (role IN ('SUPER_ADMIN','RANGER','PARK_MANAGER','LIAISON_OFFICER','RESEARCHER'));

-- The Super Admin is national (no park); field and park staff always belong to one park.
ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_park_scope_check;
ALTER TABLE auth_users ADD CONSTRAINT auth_users_park_scope_check CHECK (
  (role = 'SUPER_ADMIN' AND park_id IS NULL)
  OR (role IN ('RANGER','PARK_MANAGER','LIAISON_OFFICER') AND park_id IS NOT NULL)
  OR role = 'RESEARCHER'
);

ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_park_fk;
ALTER TABLE auth_users ADD CONSTRAINT auth_users_park_fk
  FOREIGN KEY (park_id) REFERENCES parks(id) ON DELETE RESTRICT;

ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_created_by_fk;
ALTER TABLE auth_users ADD CONSTRAINT auth_users_created_by_fk
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS auth_users_park_idx ON auth_users(park_id);
-- Exactly one Super Admin account can exist.
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_single_super_admin
  ON auth_users(role) WHERE role = 'SUPER_ADMIN';
