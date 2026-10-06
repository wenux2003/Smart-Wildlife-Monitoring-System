-- Audit trail for account and park-administration changes.
CREATE TABLE IF NOT EXISTS account_events (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'CREATED',
    'DEACTIVATED',
    'REACTIVATED',
    'PASSWORD_RESET',
    'PASSWORD_CHANGED',
    'PARK_CHANGED',
    'ROLE_CHANGED',
    'RESEARCHER_ACCESS_GRANTED',
    'RESEARCHER_ACCESS_REMOVED',
    'PARK_CREATED'
  )),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_events_target_user_idx
  ON account_events(target_user_id);
CREATE INDEX IF NOT EXISTS account_events_created_at_idx
  ON account_events(created_at);
