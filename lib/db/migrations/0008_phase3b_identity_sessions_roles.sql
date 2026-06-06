ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'app_session';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'programme_membership';

CREATE TYPE programme_membership_role AS ENUM (
  'programme_lead',
  'editor',
  'reviewer',
  'viewer',
  'external_contributor'
);

CREATE TYPE programme_membership_status AS ENUM (
  'invited',
  'active',
  'inactive',
  'completed',
  'removed'
);

ALTER TABLE users
  ADD COLUMN auth_user_id uuid;

CREATE UNIQUE INDEX users_auth_user_id_unique
  ON users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE app_sessions (
  sid text PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamp(6) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_sessions_expire_idx ON app_sessions (expire);
CREATE INDEX app_sessions_user_idx ON app_sessions (user_id);
CREATE INDEX app_sessions_revoked_idx ON app_sessions (revoked_at);

CREATE TABLE programme_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_version_id uuid NOT NULL REFERENCES programme_versions(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES institution_memberships(id) ON DELETE CASCADE,
  role programme_membership_role NOT NULL,
  status programme_membership_status NOT NULL DEFAULT 'invited',
  responsibilities text,
  starts_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_memberships_programme_membership_role_unique
  ON programme_memberships (programme_version_id, membership_id, role);
CREATE INDEX programme_memberships_institution_idx ON programme_memberships (institution_id);
CREATE INDEX programme_memberships_programme_idx ON programme_memberships (programme_version_id);
CREATE INDEX programme_memberships_membership_idx ON programme_memberships (membership_id);
CREATE INDEX programme_memberships_role_status_idx ON programme_memberships (role, status);
CREATE INDEX programme_memberships_expires_at_idx ON programme_memberships (expires_at);
