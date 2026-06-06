CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE institution_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE user_status AS ENUM ('invited', 'active', 'inactive', 'suspended');
CREATE TYPE membership_status AS ENUM ('invited', 'active', 'inactive');
CREATE TYPE role_scope AS ENUM ('platform', 'institution', 'programme');
CREATE TYPE framework_status AS ENUM ('draft', 'active', 'retired');
CREATE TYPE lens_status AS ENUM ('draft', 'active', 'retired');
CREATE TYPE lens_configuration_scope AS ENUM ('global', 'institution', 'programme');
CREATE TYPE lens_rule_type AS ENUM ('include', 'exclude', 'weight', 'threshold', 'prompt');
CREATE TYPE programme_map_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE programme_map_layer_type AS ENUM ('framework', 'lens', 'institution_priority', 'data_quality', 'readiness', 'custom');
CREATE TYPE programme_map_cell_status AS ENUM ('draft', 'ai_generated', 'human_reviewed', 'approved');
CREATE TYPE programme_map_export_format AS ENUM ('pdf', 'xlsx', 'csv', 'png', 'json');
CREATE TYPE priority_status AS ENUM ('draft', 'active', 'retired');
CREATE TYPE priority_mapping_target_type AS ENUM ('framework', 'framework_version', 'lens', 'programme', 'programme_map', 'module', 'competency');
CREATE TYPE priority_expectation_level AS ENUM ('not_applicable', 'introduce', 'develop', 'integrate', 'demonstrate');
CREATE TYPE audit_actor_type AS ENUM ('user', 'system', 'worker');
CREATE TYPE audit_subject_type AS ENUM (
  'institution',
  'user',
  'framework',
  'lens',
  'programme_map',
  'institution_priority',
  'legacy_module_review',
  'legacy_programme',
  'legacy_programme_module',
  'legacy_ga_classification'
);

CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  status institution_status NOT NULL DEFAULT 'active',
  country_code text,
  timezone text NOT NULL DEFAULT 'UTC',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX institutions_slug_unique ON institutions (slug);
CREATE INDEX institutions_status_idx ON institutions (status);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text,
  status user_status NOT NULL DEFAULT 'invited',
  external_subject text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (email);
CREATE INDEX users_status_idx ON users (status);
CREATE INDEX users_external_subject_idx ON users (external_subject);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  scope role_scope NOT NULL DEFAULT 'institution',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX roles_institution_key_unique ON roles (institution_id, key);
CREATE UNIQUE INDEX roles_global_key_unique ON roles (key) WHERE institution_id IS NULL;
CREATE INDEX roles_scope_idx ON roles (scope);

CREATE TABLE institution_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status membership_status NOT NULL DEFAULT 'invited',
  title text,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX institution_memberships_institution_user_unique ON institution_memberships (institution_id, user_id);
CREATE INDEX institution_memberships_user_idx ON institution_memberships (user_id);
CREATE INDEX institution_memberships_status_idx ON institution_memberships (status);

CREATE TABLE membership_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES institution_memberships(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX membership_roles_membership_role_unique ON membership_roles (membership_id, role_id);
CREATE INDEX membership_roles_role_idx ON membership_roles (role_id);

CREATE TABLE frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  owner_type text NOT NULL DEFAULT 'system',
  status framework_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX frameworks_institution_key_unique ON frameworks (institution_id, key);
CREATE UNIQUE INDEX frameworks_global_key_unique ON frameworks (key) WHERE institution_id IS NULL;
CREATE INDEX frameworks_institution_idx ON frameworks (institution_id);
CREATE INDEX frameworks_status_idx ON frameworks (status);

CREATE TABLE framework_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  status framework_status NOT NULL DEFAULT 'draft',
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text,
  notes text,
  valid_from timestamptz,
  valid_to timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX framework_versions_framework_label_unique ON framework_versions (framework_id, version_label);
CREATE INDEX framework_versions_framework_idx ON framework_versions (framework_id);
CREATE INDEX framework_versions_status_idx ON framework_versions (status);

CREATE TABLE lenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  status lens_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lenses_institution_key_unique ON lenses (institution_id, key);
CREATE UNIQUE INDEX lenses_global_key_unique ON lenses (key) WHERE institution_id IS NULL;
CREATE INDEX lenses_institution_idx ON lenses (institution_id);
CREATE INDEX lenses_status_idx ON lenses (status);

CREATE TABLE lens_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_id uuid NOT NULL REFERENCES lenses(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  status lens_status NOT NULL DEFAULT 'draft',
  analysis_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lens_versions_lens_label_unique ON lens_versions (lens_id, version_label);
CREATE INDEX lens_versions_lens_idx ON lens_versions (lens_id);
CREATE INDEX lens_versions_status_idx ON lens_versions (status);

CREATE TABLE lens_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lens_groups_institution_key_unique ON lens_groups (institution_id, key);
CREATE UNIQUE INDEX lens_groups_global_key_unique ON lens_groups (key) WHERE institution_id IS NULL;
CREATE INDEX lens_groups_institution_idx ON lens_groups (institution_id);

CREATE TABLE lens_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_group_id uuid NOT NULL REFERENCES lens_groups(id) ON DELETE CASCADE,
  lens_id uuid NOT NULL REFERENCES lenses(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lens_group_members_group_lens_unique ON lens_group_members (lens_group_id, lens_id);
CREATE INDEX lens_group_members_lens_idx ON lens_group_members (lens_id);

CREATE TABLE lens_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_version_id uuid NOT NULL REFERENCES lens_versions(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  scope lens_configuration_scope NOT NULL DEFAULT 'global',
  target_type text,
  target_id text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lens_configurations_lens_version_idx ON lens_configurations (lens_version_id);
CREATE INDEX lens_configurations_institution_idx ON lens_configurations (institution_id);
CREATE INDEX lens_configurations_scope_idx ON lens_configurations (scope);

CREATE TABLE lens_framework_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_version_id uuid NOT NULL REFERENCES lens_versions(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  framework_version_id uuid REFERENCES framework_versions(id) ON DELETE SET NULL,
  binding_role text NOT NULL DEFAULT 'primary',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lens_framework_bindings_unique ON lens_framework_bindings (lens_version_id, framework_id, framework_version_id);
CREATE INDEX lens_framework_bindings_framework_idx ON lens_framework_bindings (framework_id);

CREATE TABLE lens_output_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_version_id uuid NOT NULL REFERENCES lens_versions(id) ON DELETE CASCADE,
  key text NOT NULL,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lens_output_schemas_lens_key_unique ON lens_output_schemas (lens_version_id, key);

CREATE TABLE lens_evidence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_version_id uuid NOT NULL REFERENCES lens_versions(id) ON DELETE CASCADE,
  key text NOT NULL,
  rule_type lens_rule_type NOT NULL,
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lens_evidence_rules_lens_key_unique ON lens_evidence_rules (lens_version_id, key);
CREATE INDEX lens_evidence_rules_rule_type_idx ON lens_evidence_rules (rule_type);

CREATE TABLE programme_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  legacy_programme_id integer,
  programme_version_id uuid,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  status programme_map_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_maps_institution_key_unique ON programme_maps (institution_id, key);
CREATE INDEX programme_maps_institution_idx ON programme_maps (institution_id);
CREATE INDEX programme_maps_legacy_programme_idx ON programme_maps (legacy_programme_id);
CREATE INDEX programme_maps_programme_version_idx ON programme_maps (programme_version_id);
CREATE INDEX programme_maps_status_idx ON programme_maps (status);

CREATE TABLE programme_map_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_map_id uuid NOT NULL REFERENCES programme_maps(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  status programme_map_status NOT NULL DEFAULT 'draft',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_map_versions_map_label_unique ON programme_map_versions (programme_map_id, version_label);
CREATE INDEX programme_map_versions_map_idx ON programme_map_versions (programme_map_id);
CREATE INDEX programme_map_versions_status_idx ON programme_map_versions (status);

CREATE TABLE programme_map_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_map_version_id uuid NOT NULL REFERENCES programme_map_versions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  layer_type programme_map_layer_type NOT NULL,
  lens_id uuid REFERENCES lenses(id) ON DELETE SET NULL,
  lens_version_id uuid REFERENCES lens_versions(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_map_layers_version_key_unique ON programme_map_layers (programme_map_version_id, key);
CREATE INDEX programme_map_layers_version_idx ON programme_map_layers (programme_map_version_id);
CREATE INDEX programme_map_layers_lens_idx ON programme_map_layers (lens_id);
CREATE INDEX programme_map_layers_type_idx ON programme_map_layers (layer_type);

CREATE TABLE programme_map_layer_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_map_layer_id uuid NOT NULL REFERENCES programme_map_layers(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_map_layer_sources_unique ON programme_map_layer_sources (programme_map_layer_id, source_type, source_id);
CREATE INDEX programme_map_layer_sources_source_idx ON programme_map_layer_sources (source_type, source_id);

CREATE TABLE programme_map_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_map_layer_id uuid NOT NULL REFERENCES programme_map_layers(id) ON DELETE CASCADE,
  row_key text NOT NULL,
  column_key text NOT NULL,
  subject_type text,
  subject_id text,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  status programme_map_cell_status NOT NULL DEFAULT 'draft',
  evidence_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_map_cells_layer_position_unique ON programme_map_cells (programme_map_layer_id, row_key, column_key, subject_type, subject_id);
CREATE INDEX programme_map_cells_layer_idx ON programme_map_cells (programme_map_layer_id);
CREATE INDEX programme_map_cells_subject_idx ON programme_map_cells (subject_type, subject_id);
CREATE INDEX programme_map_cells_status_idx ON programme_map_cells (status);

CREATE TABLE programme_map_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_map_version_id uuid NOT NULL REFERENCES programme_map_versions(id) ON DELETE CASCADE,
  programme_map_cell_id uuid REFERENCES programme_map_cells(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  annotation_type text NOT NULL DEFAULT 'note',
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX programme_map_annotations_version_idx ON programme_map_annotations (programme_map_version_id);
CREATE INDEX programme_map_annotations_cell_idx ON programme_map_annotations (programme_map_cell_id);

CREATE TABLE programme_map_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_map_version_id uuid NOT NULL REFERENCES programme_map_versions(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  format programme_map_export_format NOT NULL,
  storage_key text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX programme_map_exports_version_idx ON programme_map_exports (programme_map_version_id);
CREATE INDEX programme_map_exports_status_idx ON programme_map_exports (status);

CREATE TABLE institution_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  status priority_status NOT NULL DEFAULT 'draft',
  owner_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX institution_priorities_institution_key_unique ON institution_priorities (institution_id, key);
CREATE INDEX institution_priorities_institution_idx ON institution_priorities (institution_id);
CREATE INDEX institution_priorities_status_idx ON institution_priorities (status);

CREATE TABLE institution_priority_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_priority_id uuid NOT NULL REFERENCES institution_priorities(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  status priority_status NOT NULL DEFAULT 'draft',
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX institution_priority_versions_priority_label_unique ON institution_priority_versions (institution_priority_id, version_label);
CREATE INDEX institution_priority_versions_priority_idx ON institution_priority_versions (institution_priority_id);
CREATE INDEX institution_priority_versions_status_idx ON institution_priority_versions (status);

CREATE TABLE priority_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_priority_version_id uuid NOT NULL REFERENCES institution_priority_versions(id) ON DELETE CASCADE,
  target_type priority_mapping_target_type NOT NULL,
  target_id text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX priority_mappings_unique ON priority_mappings (institution_priority_version_id, target_type, target_id);
CREATE INDEX priority_mappings_target_idx ON priority_mappings (target_type, target_id);

CREATE TABLE priority_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_priority_version_id uuid NOT NULL REFERENCES institution_priority_versions(id) ON DELETE CASCADE,
  target_type priority_mapping_target_type NOT NULL,
  target_id text NOT NULL,
  expected_level priority_expectation_level NOT NULL DEFAULT 'not_applicable',
  rationale text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX priority_expectations_unique ON priority_expectations (institution_priority_version_id, target_type, target_id);
CREATE INDEX priority_expectations_level_idx ON priority_expectations (expected_level);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
  actor_type audit_actor_type NOT NULL DEFAULT 'system',
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_identifier text,
  action_type text NOT NULL,
  subject_type audit_subject_type NOT NULL,
  subject_id text,
  legacy_table text,
  legacy_id text,
  request_id text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_institution_idx ON audit_events (institution_id);
CREATE INDEX audit_events_actor_user_idx ON audit_events (actor_user_id);
CREATE INDEX audit_events_subject_idx ON audit_events (subject_type, subject_id);
CREATE INDEX audit_events_legacy_idx ON audit_events (legacy_table, legacy_id);
CREATE INDEX audit_events_created_at_idx ON audit_events (created_at);
