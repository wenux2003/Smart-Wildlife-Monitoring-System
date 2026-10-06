CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'RESEARCHER' CHECK (role IN ('RANGER','PARK_MANAGER','LIAISON_OFFICER','RESEARCHER')),
  park_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(email))
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
