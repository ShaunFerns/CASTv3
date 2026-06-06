-- CAST v3 Phase 4A: Curriculum ingestion pipeline foundation.
-- Adds cross-pathway ingestion tracking for Akari imports, single PDF descriptors,
-- manual module entry and future programme wizard flows.

alter type audit_subject_type add value if not exists 'ingestion_run';
alter type audit_subject_type add value if not exists 'ingestion_item';
alter type audit_subject_type add value if not exists 'ingestion_error';

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  pathway text not null,
  status text not null default 'pending',
  import_batch_id uuid references import_batches(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  requested_by_user_id uuid references users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingestion_runs_pathway_check check (pathway in ('akari', 'single_pdf', 'manual_module', 'programme_wizard')),
  constraint ingestion_runs_status_check check (status in ('pending', 'running', 'completed', 'completed_with_issues', 'failed', 'cancelled'))
);

create index if not exists ingestion_runs_institution_idx on ingestion_runs(institution_id);
create index if not exists ingestion_runs_status_idx on ingestion_runs(status);
create index if not exists ingestion_runs_pathway_idx on ingestion_runs(pathway);
create index if not exists ingestion_runs_import_batch_idx on ingestion_runs(import_batch_id);
create index if not exists ingestion_runs_document_idx on ingestion_runs(document_id);
create index if not exists ingestion_runs_requested_by_idx on ingestion_runs(requested_by_user_id);

create table if not exists ingestion_items (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references ingestion_runs(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  item_type text not null default 'module_descriptor',
  status text not null default 'pending',
  source_identifier text,
  row_number text,
  input_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingestion_items_status_check check (status in ('pending', 'running', 'completed', 'completed_with_issues', 'failed', 'skipped'))
);

create index if not exists ingestion_items_run_idx on ingestion_items(ingestion_run_id);
create index if not exists ingestion_items_institution_idx on ingestion_items(institution_id);
create index if not exists ingestion_items_type_status_idx on ingestion_items(item_type, status);
create index if not exists ingestion_items_source_identifier_idx on ingestion_items(source_identifier);

create table if not exists ingestion_errors (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references ingestion_runs(id) on delete cascade,
  ingestion_item_id uuid references ingestion_items(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  severity text not null default 'warning',
  code text not null,
  message text not null,
  field_path text,
  source_location jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ingestion_errors_severity_check check (severity in ('info', 'warning', 'error', 'critical'))
);

create index if not exists ingestion_errors_run_idx on ingestion_errors(ingestion_run_id);
create index if not exists ingestion_errors_item_idx on ingestion_errors(ingestion_item_id);
create index if not exists ingestion_errors_institution_idx on ingestion_errors(institution_id);
create index if not exists ingestion_errors_code_idx on ingestion_errors(code);
create index if not exists ingestion_errors_severity_idx on ingestion_errors(severity);

create table if not exists ingestion_record_links (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references ingestion_runs(id) on delete cascade,
  ingestion_item_id uuid references ingestion_items(id) on delete cascade,
  relationship text not null default 'created',
  import_batch_id uuid references import_batches(id) on delete restrict,
  source_record_id uuid references source_records(id) on delete restrict,
  source_programme_id uuid references source_programmes(id) on delete restrict,
  source_module_id uuid references source_modules(id) on delete restrict,
  source_structure_item_id uuid references source_structure_items(id) on delete restrict,
  document_id uuid references documents(id) on delete restrict,
  document_version_id uuid references document_versions(id) on delete restrict,
  document_section_id uuid references document_sections(id) on delete restrict,
  module_id uuid references modules(id) on delete restrict,
  module_descriptor_id uuid references module_descriptors(id) on delete restrict,
  descriptor_section_id uuid references descriptor_sections(id) on delete restrict,
  evidence_item_id uuid references evidence_items(id) on delete restrict,
  data_quality_result_id uuid references data_quality_results(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ingestion_record_links_single_target_check check (
    num_nonnulls(
      import_batch_id,
      source_record_id,
      source_programme_id,
      source_module_id,
      source_structure_item_id,
      document_id,
      document_version_id,
      document_section_id,
      module_id,
      module_descriptor_id,
      descriptor_section_id,
      evidence_item_id,
      data_quality_result_id
    ) = 1
  )
);

create index if not exists ingestion_record_links_run_idx on ingestion_record_links(ingestion_run_id);
create index if not exists ingestion_record_links_item_idx on ingestion_record_links(ingestion_item_id);
create index if not exists ingestion_record_links_relationship_idx on ingestion_record_links(relationship);
create index if not exists ingestion_record_links_module_idx on ingestion_record_links(module_id);
create index if not exists ingestion_record_links_descriptor_idx on ingestion_record_links(module_descriptor_id);
create index if not exists ingestion_record_links_evidence_idx on ingestion_record_links(evidence_item_id);

insert into data_quality_rules (
  key,
  name,
  description,
  category,
  default_severity,
  status,
  implementation_key,
  rule_definition,
  remediation_guidance,
  is_system_managed
)
select *
from (
  values
    ('ingestion.missing_module_code', 'Missing module code', 'A curriculum ingestion item did not provide a module code.', 'completeness'::data_quality_category, 'error'::data_quality_severity, 'active'::data_quality_rule_status, 'ingestion.missing_module_code', '{"field":"moduleCode"}'::jsonb, 'Review the source record or manual entry and add a stable module code where available.', true),
    ('ingestion.missing_module_title', 'Missing module title', 'A curriculum ingestion item did not provide a module title.', 'completeness'::data_quality_category, 'error'::data_quality_severity, 'active'::data_quality_rule_status, 'ingestion.missing_module_title', '{"field":"moduleTitle"}'::jsonb, 'Review the source record or manual entry and add the module title.', true),
    ('ingestion.missing_credits', 'Missing credits', 'A curriculum ingestion item did not provide credits.', 'completeness'::data_quality_category, 'warning'::data_quality_severity, 'active'::data_quality_rule_status, 'ingestion.missing_credits', '{"field":"credits"}'::jsonb, 'Confirm the module credit value before relying on workload or progression reports.', true),
    ('ingestion.missing_stage', 'Missing stage', 'A curriculum ingestion item did not provide a stage/year.', 'mapping'::data_quality_category, 'warning'::data_quality_severity, 'active'::data_quality_rule_status, 'ingestion.missing_stage', '{"field":"stage"}'::jsonb, 'Assign the module to a stage/year in the curated programme structure.', true),
    ('ingestion.missing_semester', 'Missing semester', 'A curriculum ingestion item did not provide a semester/teaching period.', 'mapping'::data_quality_category, 'warning'::data_quality_severity, 'active'::data_quality_rule_status, 'ingestion.missing_semester', '{"field":"semester"}'::jsonb, 'Assign the module to a semester or teaching period where programme mapping requires it.', true)
) as seed(key, name, description, category, default_severity, status, implementation_key, rule_definition, remediation_guidance, is_system_managed)
where not exists (
  select 1
  from data_quality_rules existing
  where existing.institution_id is null
    and existing.key = seed.key
);
