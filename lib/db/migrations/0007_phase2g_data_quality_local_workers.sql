ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'data_quality_rule';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'data_quality_run';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'data_quality_result';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'local_worker';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'worker_job';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'worker_job_artifact';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'worker_sync_event';

CREATE TYPE data_quality_rule_status AS ENUM ('draft', 'active', 'retired');
CREATE TYPE data_quality_category AS ENUM (
  'completeness',
  'consistency',
  'integrity',
  'timeliness',
  'duplication',
  'mapping',
  'assessment',
  'other'
);
CREATE TYPE data_quality_severity AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE data_quality_run_status AS ENUM (
  'pending',
  'running',
  'completed',
  'completed_with_issues',
  'failed',
  'cancelled'
);
CREATE TYPE data_quality_run_trigger AS ENUM ('manual', 'import', 'scheduled', 'worker', 'api', 'system');
CREATE TYPE data_quality_result_status AS ENUM (
  'open',
  'acknowledged',
  'resolved',
  'accepted_risk',
  'false_positive',
  'superseded'
);
CREATE TYPE local_worker_status AS ENUM ('pending', 'active', 'offline', 'disabled', 'revoked');
CREATE TYPE worker_connection_mode AS ENUM ('pull', 'callback', 'hybrid');
CREATE TYPE worker_job_type AS ENUM (
  'document_extraction',
  'embeddings',
  'ai_classification',
  'batch_analysis',
  'data_quality',
  'other'
);
CREATE TYPE worker_job_status AS ENUM (
  'queued',
  'claimed',
  'running',
  'syncing',
  'completed',
  'failed',
  'cancelled',
  'expired'
);
CREATE TYPE worker_data_handling_mode AS ENUM (
  'cloud_allowed',
  'local_preferred',
  'local_required',
  'restricted'
);
CREATE TYPE worker_artifact_type AS ENUM (
  'input',
  'output',
  'log',
  'manifest',
  'extracted_text',
  'embedding',
  'classification',
  'report',
  'other'
);
CREATE TYPE worker_artifact_location AS ENUM (
  'local_worker',
  'cast_managed',
  'institution_managed',
  'external'
);
CREATE TYPE worker_sync_direction AS ENUM ('worker_to_cast', 'cast_to_worker');
CREATE TYPE worker_sync_event_type AS ENUM (
  'job_claimed',
  'heartbeat',
  'progress',
  'artifact_registered',
  'result_uploaded',
  'job_completed',
  'job_failed',
  'sync_error',
  'other'
);
CREATE TYPE worker_sync_event_status AS ENUM ('pending', 'accepted', 'rejected', 'failed');

CREATE TABLE data_quality_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  category data_quality_category NOT NULL,
  default_severity data_quality_severity NOT NULL DEFAULT 'warning',
  status data_quality_rule_status NOT NULL DEFAULT 'draft',
  implementation_key text NOT NULL,
  rule_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  remediation_guidance text,
  is_system_managed boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX data_quality_rules_institution_key_unique
  ON data_quality_rules (institution_id, key);
CREATE UNIQUE INDEX data_quality_rules_global_key_unique
  ON data_quality_rules (key)
  WHERE institution_id IS NULL;
CREATE INDEX data_quality_rules_institution_idx ON data_quality_rules (institution_id);
CREATE INDEX data_quality_rules_category_status_idx ON data_quality_rules (category, status);
CREATE INDEX data_quality_rules_implementation_idx ON data_quality_rules (implementation_key);

CREATE TABLE data_quality_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  source_system_id uuid REFERENCES source_systems(id) ON DELETE SET NULL,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  curated_structure_id uuid REFERENCES curated_structures(id) ON DELETE SET NULL,
  review_cycle_id uuid REFERENCES review_cycles(id) ON DELETE SET NULL,
  status data_quality_run_status NOT NULL DEFAULT 'pending',
  trigger data_quality_run_trigger NOT NULL DEFAULT 'manual',
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX data_quality_runs_institution_idx ON data_quality_runs (institution_id);
CREATE INDEX data_quality_runs_source_system_idx ON data_quality_runs (source_system_id);
CREATE INDEX data_quality_runs_import_batch_idx ON data_quality_runs (import_batch_id);
CREATE INDEX data_quality_runs_programme_idx ON data_quality_runs (programme_version_id);
CREATE INDEX data_quality_runs_structure_idx ON data_quality_runs (curated_structure_id);
CREATE INDEX data_quality_runs_review_cycle_idx ON data_quality_runs (review_cycle_id);
CREATE INDEX data_quality_runs_status_trigger_idx ON data_quality_runs (status, trigger);

CREATE TABLE data_quality_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  data_quality_run_id uuid NOT NULL REFERENCES data_quality_runs(id) ON DELETE CASCADE,
  data_quality_rule_id uuid NOT NULL REFERENCES data_quality_rules(id) ON DELETE RESTRICT,
  severity data_quality_severity NOT NULL,
  status data_quality_result_status NOT NULL DEFAULT 'open',
  fingerprint text,
  title text NOT NULL,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_notes text,
  reviewed_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX data_quality_results_run_rule_fingerprint_unique
  ON data_quality_results (data_quality_run_id, data_quality_rule_id, fingerprint)
  WHERE fingerprint IS NOT NULL;
CREATE INDEX data_quality_results_institution_idx ON data_quality_results (institution_id);
CREATE INDEX data_quality_results_run_idx ON data_quality_results (data_quality_run_id);
CREATE INDEX data_quality_results_rule_idx ON data_quality_results (data_quality_rule_id);
CREATE INDEX data_quality_results_severity_status_idx ON data_quality_results (severity, status);
CREATE INDEX data_quality_results_reviewer_idx ON data_quality_results (reviewed_by_membership_id);

CREATE TABLE data_quality_result_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_quality_result_id uuid NOT NULL REFERENCES data_quality_results(id) ON DELETE CASCADE,
  source_system_id uuid REFERENCES source_systems(id) ON DELETE RESTRICT,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE RESTRICT,
  source_record_id uuid REFERENCES source_records(id) ON DELETE RESTRICT,
  source_programme_id uuid REFERENCES source_programmes(id) ON DELETE RESTRICT,
  source_module_id uuid REFERENCES source_modules(id) ON DELETE RESTRICT,
  source_structure_item_id uuid REFERENCES source_structure_items(id) ON DELETE RESTRICT,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE RESTRICT,
  curated_structure_id uuid REFERENCES curated_structures(id) ON DELETE RESTRICT,
  curated_structure_group_id uuid REFERENCES curated_structure_groups(id) ON DELETE RESTRICT,
  curated_structure_item_id uuid REFERENCES curated_structure_items(id) ON DELETE RESTRICT,
  module_id uuid REFERENCES modules(id) ON DELETE RESTRICT,
  module_descriptor_id uuid REFERENCES module_descriptors(id) ON DELETE RESTRICT,
  evidence_item_id uuid REFERENCES evidence_items(id) ON DELETE RESTRICT,
  review_cycle_id uuid REFERENCES review_cycles(id) ON DELETE RESTRICT,
  competency_id uuid REFERENCES competencies(id) ON DELETE RESTRICT,
  relationship text NOT NULL DEFAULT 'affected_record',
  locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_quality_result_links_single_target_check CHECK (
    num_nonnulls(
      source_system_id,
      import_batch_id,
      source_record_id,
      source_programme_id,
      source_module_id,
      source_structure_item_id,
      programme_version_id,
      curated_structure_id,
      curated_structure_group_id,
      curated_structure_item_id,
      module_id,
      module_descriptor_id,
      evidence_item_id,
      review_cycle_id,
      competency_id
    ) = 1
  )
);

CREATE INDEX data_quality_result_links_result_idx ON data_quality_result_links (data_quality_result_id);
CREATE INDEX data_quality_result_links_source_system_idx ON data_quality_result_links (source_system_id);
CREATE INDEX data_quality_result_links_import_batch_idx ON data_quality_result_links (import_batch_id);
CREATE INDEX data_quality_result_links_source_record_idx ON data_quality_result_links (source_record_id);
CREATE INDEX data_quality_result_links_source_programme_idx ON data_quality_result_links (source_programme_id);
CREATE INDEX data_quality_result_links_source_module_idx ON data_quality_result_links (source_module_id);
CREATE INDEX data_quality_result_links_source_structure_idx ON data_quality_result_links (source_structure_item_id);
CREATE INDEX data_quality_result_links_programme_idx ON data_quality_result_links (programme_version_id);
CREATE INDEX data_quality_result_links_structure_idx ON data_quality_result_links (curated_structure_id);
CREATE INDEX data_quality_result_links_structure_group_idx ON data_quality_result_links (curated_structure_group_id);
CREATE INDEX data_quality_result_links_structure_item_idx ON data_quality_result_links (curated_structure_item_id);
CREATE INDEX data_quality_result_links_module_idx ON data_quality_result_links (module_id);
CREATE INDEX data_quality_result_links_descriptor_idx ON data_quality_result_links (module_descriptor_id);
CREATE INDEX data_quality_result_links_evidence_idx ON data_quality_result_links (evidence_item_id);
CREATE INDEX data_quality_result_links_review_cycle_idx ON data_quality_result_links (review_cycle_id);
CREATE INDEX data_quality_result_links_competency_idx ON data_quality_result_links (competency_id);

CREATE TABLE local_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  status local_worker_status NOT NULL DEFAULT 'pending',
  connection_mode worker_connection_mode NOT NULL DEFAULT 'pull',
  software_version text,
  runtime text,
  public_key text,
  credential_fingerprint text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_data_classes jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  registered_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX local_workers_institution_key_unique ON local_workers (institution_id, key);
CREATE INDEX local_workers_institution_idx ON local_workers (institution_id);
CREATE INDEX local_workers_status_idx ON local_workers (status);
CREATE INDEX local_workers_last_seen_idx ON local_workers (last_seen_at);
CREATE INDEX local_workers_credential_fingerprint_idx ON local_workers (credential_fingerprint);

CREATE TABLE worker_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  local_worker_id uuid REFERENCES local_workers(id) ON DELETE SET NULL,
  analysis_run_id uuid REFERENCES analysis_runs(id) ON DELETE SET NULL,
  data_quality_run_id uuid REFERENCES data_quality_runs(id) ON DELETE SET NULL,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL,
  document_version_id uuid REFERENCES document_versions(id) ON DELETE SET NULL,
  job_type worker_job_type NOT NULL,
  status worker_job_status NOT NULL DEFAULT 'queued',
  data_handling_mode worker_data_handling_mode NOT NULL DEFAULT 'local_preferred',
  priority integer NOT NULL DEFAULT 0,
  idempotency_key text,
  input_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX worker_jobs_institution_idempotency_unique
  ON worker_jobs (institution_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX worker_jobs_institution_idx ON worker_jobs (institution_id);
CREATE INDEX worker_jobs_worker_idx ON worker_jobs (local_worker_id);
CREATE INDEX worker_jobs_type_status_idx ON worker_jobs (job_type, status);
CREATE INDEX worker_jobs_analysis_run_idx ON worker_jobs (analysis_run_id);
CREATE INDEX worker_jobs_data_quality_run_idx ON worker_jobs (data_quality_run_id);
CREATE INDEX worker_jobs_import_batch_idx ON worker_jobs (import_batch_id);
CREATE INDEX worker_jobs_document_version_idx ON worker_jobs (document_version_id);
CREATE INDEX worker_jobs_available_idx ON worker_jobs (status, available_at);

CREATE TABLE worker_job_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  worker_job_id uuid NOT NULL REFERENCES worker_jobs(id) ON DELETE CASCADE,
  artifact_type worker_artifact_type NOT NULL,
  location worker_artifact_location NOT NULL,
  name text,
  locator text,
  content_type text,
  checksum text,
  size_bytes bigint,
  is_sensitive boolean NOT NULL DEFAULT false,
  encryption_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX worker_job_artifacts_job_type_checksum_unique
  ON worker_job_artifacts (worker_job_id, artifact_type, checksum)
  WHERE checksum IS NOT NULL;
CREATE INDEX worker_job_artifacts_institution_idx ON worker_job_artifacts (institution_id);
CREATE INDEX worker_job_artifacts_job_idx ON worker_job_artifacts (worker_job_id);
CREATE INDEX worker_job_artifacts_type_location_idx ON worker_job_artifacts (artifact_type, location);
CREATE INDEX worker_job_artifacts_checksum_idx ON worker_job_artifacts (checksum);

CREATE TABLE worker_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  local_worker_id uuid NOT NULL REFERENCES local_workers(id) ON DELETE CASCADE,
  worker_job_id uuid REFERENCES worker_jobs(id) ON DELETE SET NULL,
  worker_job_artifact_id uuid REFERENCES worker_job_artifacts(id) ON DELETE SET NULL,
  direction worker_sync_direction NOT NULL,
  event_type worker_sync_event_type NOT NULL,
  status worker_sync_event_status NOT NULL DEFAULT 'pending',
  idempotency_key text,
  correlation_id text,
  sequence_number integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX worker_sync_events_worker_idempotency_unique
  ON worker_sync_events (local_worker_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX worker_sync_events_institution_idx ON worker_sync_events (institution_id);
CREATE INDEX worker_sync_events_worker_idx ON worker_sync_events (local_worker_id);
CREATE INDEX worker_sync_events_job_idx ON worker_sync_events (worker_job_id);
CREATE INDEX worker_sync_events_artifact_idx ON worker_sync_events (worker_job_artifact_id);
CREATE INDEX worker_sync_events_type_status_idx ON worker_sync_events (event_type, status);
CREATE INDEX worker_sync_events_received_idx ON worker_sync_events (received_at);
