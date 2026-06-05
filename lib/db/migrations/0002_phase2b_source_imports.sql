ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'source_system';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'import_batch';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'source_record';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'source_programme';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'source_module';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'source_structure_item';

CREATE TYPE source_system_type AS ENUM (
  'akari',
  'banner',
  'sits',
  'manual_upload',
  'api',
  'csv',
  'other'
);

CREATE TYPE source_system_status AS ENUM (
  'active',
  'inactive',
  'archived'
);

CREATE TYPE import_batch_status AS ENUM (
  'pending',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled'
);

CREATE TYPE import_batch_type AS ENUM (
  'programme_catalogue',
  'module_catalogue',
  'programme_structure',
  'document_set',
  'mixed'
);

CREATE TYPE source_record_type AS ENUM (
  'programme',
  'module',
  'structure_item',
  'document',
  'other'
);

CREATE TYPE source_record_status AS ENUM (
  'raw',
  'parsed',
  'reconciled',
  'ignored',
  'error'
);

CREATE TYPE source_structure_item_type AS ENUM (
  'module',
  'group',
  'choice',
  'pathway',
  'stage',
  'year',
  'other'
);

CREATE TYPE reconciliation_status AS ENUM (
  'candidate',
  'confirmed',
  'rejected',
  'superseded'
);

CREATE TYPE reconciliation_source_type AS ENUM (
  'source_record',
  'source_programme',
  'source_module',
  'source_structure_item'
);

CREATE TYPE reconciliation_target_type AS ENUM (
  'legacy_programme',
  'legacy_module_review',
  'legacy_programme_module',
  'programme',
  'programme_version',
  'module',
  'curated_structure_item',
  'document',
  'other'
);

CREATE TABLE source_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  system_type source_system_type NOT NULL DEFAULT 'other',
  status source_system_status NOT NULL DEFAULT 'active',
  connection_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX source_systems_institution_key_unique ON source_systems (institution_id, key);
CREATE INDEX source_systems_institution_idx ON source_systems (institution_id);
CREATE INDEX source_systems_type_idx ON source_systems (system_type);
CREATE INDEX source_systems_status_idx ON source_systems (status);

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  source_system_id uuid NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
  batch_type import_batch_type NOT NULL DEFAULT 'mixed',
  status import_batch_status NOT NULL DEFAULT 'pending',
  external_batch_id text,
  source_started_at timestamptz,
  source_completed_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX import_batches_source_external_unique ON import_batches (source_system_id, external_batch_id) WHERE external_batch_id IS NOT NULL;
CREATE INDEX import_batches_institution_idx ON import_batches (institution_id);
CREATE INDEX import_batches_source_system_idx ON import_batches (source_system_id);
CREATE INDEX import_batches_status_idx ON import_batches (status);
CREATE INDEX import_batches_type_idx ON import_batches (batch_type);

CREATE TABLE source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  import_batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  source_system_id uuid NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
  record_type source_record_type NOT NULL,
  status source_record_status NOT NULL DEFAULT 'raw',
  source_identifier text,
  source_hash text,
  row_number integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_text text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX source_records_batch_identifier_unique ON source_records (import_batch_id, record_type, source_identifier) WHERE source_identifier IS NOT NULL;
CREATE INDEX source_records_institution_idx ON source_records (institution_id);
CREATE INDEX source_records_batch_idx ON source_records (import_batch_id);
CREATE INDEX source_records_system_idx ON source_records (source_system_id);
CREATE INDEX source_records_type_status_idx ON source_records (record_type, status);
CREATE INDEX source_records_hash_idx ON source_records (source_hash);

CREATE TABLE source_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  import_batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  source_system_id uuid NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  external_id text,
  code text,
  name text,
  award text,
  level text,
  school text,
  department text,
  owning_unit text,
  campus text,
  mode_of_delivery text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_programme_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX source_programmes_system_external_unique ON source_programmes (source_system_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX source_programmes_institution_idx ON source_programmes (institution_id);
CREATE INDEX source_programmes_batch_idx ON source_programmes (import_batch_id);
CREATE INDEX source_programmes_code_idx ON source_programmes (code);
CREATE INDEX source_programmes_legacy_idx ON source_programmes (legacy_programme_id);

CREATE TABLE source_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  import_batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  source_system_id uuid NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  external_id text,
  module_code text,
  module_title text,
  credits text,
  level text,
  stage text,
  semester text,
  school text,
  department text,
  campus text,
  module_status text,
  descriptor_text text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_module_review_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX source_modules_system_external_unique ON source_modules (source_system_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX source_modules_institution_idx ON source_modules (institution_id);
CREATE INDEX source_modules_batch_idx ON source_modules (import_batch_id);
CREATE INDEX source_modules_code_idx ON source_modules (module_code);
CREATE INDEX source_modules_legacy_idx ON source_modules (legacy_module_review_id);

CREATE TABLE source_structure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  import_batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  source_system_id uuid NOT NULL REFERENCES source_systems(id) ON DELETE CASCADE,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  source_programme_id uuid REFERENCES source_programmes(id) ON DELETE SET NULL,
  source_module_id uuid REFERENCES source_modules(id) ON DELETE SET NULL,
  item_type source_structure_item_type NOT NULL DEFAULT 'module',
  external_id text,
  parent_external_id text,
  stage text,
  semester text,
  pathway text,
  group_name text,
  core_option text,
  credits text,
  order_index integer NOT NULL DEFAULT 0,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_programme_module_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX source_structure_items_system_external_unique ON source_structure_items (source_system_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX source_structure_items_institution_idx ON source_structure_items (institution_id);
CREATE INDEX source_structure_items_batch_idx ON source_structure_items (import_batch_id);
CREATE INDEX source_structure_items_programme_idx ON source_structure_items (source_programme_id);
CREATE INDEX source_structure_items_module_idx ON source_structure_items (source_module_id);
CREATE INDEX source_structure_items_legacy_idx ON source_structure_items (legacy_programme_module_id);

CREATE TABLE reconciliation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  source_type reconciliation_source_type NOT NULL,
  source_id text NOT NULL,
  target_type reconciliation_target_type NOT NULL,
  target_id text NOT NULL,
  status reconciliation_status NOT NULL DEFAULT 'candidate',
  confidence real,
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reconciliation_links_source_target_unique ON reconciliation_links (institution_id, source_type, source_id, target_type, target_id);
CREATE INDEX reconciliation_links_source_idx ON reconciliation_links (source_type, source_id);
CREATE INDEX reconciliation_links_target_idx ON reconciliation_links (target_type, target_id);
CREATE INDEX reconciliation_links_status_idx ON reconciliation_links (status);
