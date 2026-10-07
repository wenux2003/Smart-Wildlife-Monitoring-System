CREATE TABLE IF NOT EXISTS export_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  export_type text NOT NULL,
  query_params jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_audits_user_id ON export_audits(user_id);
