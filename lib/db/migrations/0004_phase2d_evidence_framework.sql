ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'document';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'document_version';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'document_section';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'evidence_item';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'competency_domain';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'competency';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'programme_graduate_attribute';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'competency_evaluation';

CREATE TYPE document_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE document_type AS ENUM (
  'programme_specification',
  'module_descriptor',
  'validation_document',
  'accreditation_document',
  'review_report',
  'policy',
  'strategy',
  'assessment_document',
  'other'
);
CREATE TYPE document_section_type AS ENUM ('heading', 'paragraph', 'table', 'list', 'appendix', 'other');
CREATE TYPE evidence_source_kind AS ENUM (
  'document_section',
  'descriptor_section',
  'learning_outcome',
  'assessment_component',
  'extracted_text',
  'manual',
  'other'
);
CREATE TYPE evidence_item_status AS ENUM ('extracted', 'reviewed', 'accepted', 'rejected', 'archived');
CREATE TYPE scaffolding_level AS ENUM ('not_applicable', 'introduce', 'develop', 'integrate', 'demonstrate');
CREATE TYPE expectation_scope AS ENUM ('programme', 'stage', 'semester', 'pathway', 'module_group', 'module');
CREATE TYPE graduate_attribute_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE competency_evaluation_source AS ENUM ('ai', 'human', 'rule', 'import');
CREATE TYPE competency_evaluation_status AS ENUM ('draft', 'needs_review', 'reviewed', 'rejected', 'superseded');

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  source_system_id uuid REFERENCES source_systems(id) ON DELETE SET NULL,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  module_descriptor_id uuid REFERENCES module_descriptors(id) ON DELETE SET NULL,
  document_type document_type NOT NULL DEFAULT 'other',
  title text,
  external_id text,
  status document_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_institution_idx ON documents (institution_id);
CREATE INDEX documents_source_system_idx ON documents (source_system_id);
CREATE INDEX documents_source_record_idx ON documents (source_record_id);
CREATE INDEX documents_programme_version_idx ON documents (programme_version_id);
CREATE INDEX documents_module_idx ON documents (module_id);
CREATE INDEX documents_module_descriptor_idx ON documents (module_descriptor_id);
CREATE INDEX documents_type_status_idx ON documents (document_type, status);

CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  version_label text NOT NULL,
  file_name text,
  mime_type text,
  storage_key text,
  checksum text,
  raw_text text,
  status document_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX document_versions_document_label_unique ON document_versions (document_id, version_label);
CREATE INDEX document_versions_institution_idx ON document_versions (institution_id);
CREATE INDEX document_versions_import_batch_idx ON document_versions (import_batch_id);
CREATE INDEX document_versions_source_record_idx ON document_versions (source_record_id);
CREATE INDEX document_versions_checksum_idx ON document_versions (checksum);
CREATE INDEX document_versions_status_idx ON document_versions (status);

CREATE TABLE document_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  parent_section_id uuid REFERENCES document_sections(id) ON DELETE CASCADE,
  section_type document_section_type NOT NULL DEFAULT 'other',
  heading text,
  content text,
  page_start integer,
  page_end integer,
  character_start integer,
  character_end integer,
  order_index integer NOT NULL DEFAULT 0,
  source_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_sections_institution_idx ON document_sections (institution_id);
CREATE INDEX document_sections_version_idx ON document_sections (document_version_id);
CREATE INDEX document_sections_parent_idx ON document_sections (parent_section_id);
CREATE INDEX document_sections_type_idx ON document_sections (section_type);

CREATE TABLE evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_version_id uuid REFERENCES document_versions(id) ON DELETE SET NULL,
  document_section_id uuid REFERENCES document_sections(id) ON DELETE SET NULL,
  descriptor_section_id uuid REFERENCES descriptor_sections(id) ON DELETE SET NULL,
  learning_outcome_id uuid REFERENCES learning_outcomes(id) ON DELETE SET NULL,
  assessment_component_id uuid REFERENCES assessment_components(id) ON DELETE SET NULL,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  curated_structure_item_id uuid REFERENCES curated_structure_items(id) ON DELETE SET NULL,
  source_kind evidence_source_kind NOT NULL,
  evidence_text text,
  character_start integer,
  character_end integer,
  confidence real,
  status evidence_item_status NOT NULL DEFAULT 'extracted',
  source_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evidence_items_institution_idx ON evidence_items (institution_id);
CREATE INDEX evidence_items_document_version_idx ON evidence_items (document_version_id);
CREATE INDEX evidence_items_document_section_idx ON evidence_items (document_section_id);
CREATE INDEX evidence_items_descriptor_section_idx ON evidence_items (descriptor_section_id);
CREATE INDEX evidence_items_learning_outcome_idx ON evidence_items (learning_outcome_id);
CREATE INDEX evidence_items_assessment_component_idx ON evidence_items (assessment_component_id);
CREATE INDEX evidence_items_programme_version_idx ON evidence_items (programme_version_id);
CREATE INDEX evidence_items_module_idx ON evidence_items (module_id);
CREATE INDEX evidence_items_structure_item_idx ON evidence_items (curated_structure_item_id);
CREATE INDEX evidence_items_kind_status_idx ON evidence_items (source_kind, status);

CREATE TABLE evidence_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX evidence_tags_institution_key_unique ON evidence_tags (institution_id, key);
CREATE INDEX evidence_tags_institution_idx ON evidence_tags (institution_id);

CREATE TABLE evidence_item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  evidence_tag_id uuid NOT NULL REFERENCES evidence_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX evidence_item_tags_item_tag_unique ON evidence_item_tags (evidence_item_id, evidence_tag_id);
CREATE INDEX evidence_item_tags_tag_idx ON evidence_item_tags (evidence_tag_id);

CREATE TABLE competency_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_version_id uuid NOT NULL REFERENCES framework_versions(id) ON DELETE CASCADE,
  parent_domain_id uuid REFERENCES competency_domains(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX competency_domains_framework_key_unique ON competency_domains (framework_version_id, key);
CREATE INDEX competency_domains_framework_idx ON competency_domains (framework_version_id);
CREATE INDEX competency_domains_parent_idx ON competency_domains (parent_domain_id);

CREATE TABLE competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_version_id uuid NOT NULL REFERENCES framework_versions(id) ON DELETE CASCADE,
  competency_domain_id uuid REFERENCES competency_domains(id) ON DELETE SET NULL,
  parent_competency_id uuid REFERENCES competencies(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX competencies_framework_key_unique ON competencies (framework_version_id, key);
CREATE INDEX competencies_framework_idx ON competencies (framework_version_id);
CREATE INDEX competencies_domain_idx ON competencies (competency_domain_id);
CREATE INDEX competencies_parent_idx ON competencies (parent_competency_id);

CREATE TABLE programme_graduate_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_version_id uuid NOT NULL REFERENCES programme_versions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  status graduate_attribute_status NOT NULL DEFAULT 'draft',
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_graduate_attributes_programme_key_unique ON programme_graduate_attributes (programme_version_id, key);
CREATE INDEX programme_graduate_attributes_institution_idx ON programme_graduate_attributes (institution_id);
CREATE INDEX programme_graduate_attributes_programme_idx ON programme_graduate_attributes (programme_version_id);
CREATE INDEX programme_graduate_attributes_status_idx ON programme_graduate_attributes (status);

CREATE TABLE programme_attribute_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_version_id uuid NOT NULL REFERENCES programme_versions(id) ON DELETE CASCADE,
  programme_graduate_attribute_id uuid NOT NULL REFERENCES programme_graduate_attributes(id) ON DELETE CASCADE,
  scope expectation_scope NOT NULL DEFAULT 'programme',
  stage text,
  semester text,
  pathway text,
  curated_structure_group_id uuid REFERENCES curated_structure_groups(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  expected_level scaffolding_level NOT NULL DEFAULT 'not_applicable',
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX programme_attribute_expectations_institution_idx ON programme_attribute_expectations (institution_id);
CREATE INDEX programme_attribute_expectations_programme_idx ON programme_attribute_expectations (programme_version_id);
CREATE INDEX programme_attribute_expectations_attribute_idx ON programme_attribute_expectations (programme_graduate_attribute_id);
CREATE INDEX programme_attribute_expectations_scope_idx ON programme_attribute_expectations (scope);
CREATE INDEX programme_attribute_expectations_group_idx ON programme_attribute_expectations (curated_structure_group_id);
CREATE INDEX programme_attribute_expectations_module_idx ON programme_attribute_expectations (module_id);

CREATE TABLE programme_competency_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_version_id uuid NOT NULL REFERENCES programme_versions(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  scope expectation_scope NOT NULL DEFAULT 'programme',
  stage text,
  semester text,
  pathway text,
  curated_structure_group_id uuid REFERENCES curated_structure_groups(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  expected_level scaffolding_level NOT NULL DEFAULT 'not_applicable',
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX programme_competency_expectations_institution_idx ON programme_competency_expectations (institution_id);
CREATE INDEX programme_competency_expectations_programme_idx ON programme_competency_expectations (programme_version_id);
CREATE INDEX programme_competency_expectations_competency_idx ON programme_competency_expectations (competency_id);
CREATE INDEX programme_competency_expectations_scope_idx ON programme_competency_expectations (scope);
CREATE INDEX programme_competency_expectations_group_idx ON programme_competency_expectations (curated_structure_group_id);
CREATE INDEX programme_competency_expectations_module_idx ON programme_competency_expectations (module_id);

CREATE TABLE competency_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  competency_id uuid REFERENCES competencies(id) ON DELETE SET NULL,
  programme_graduate_attribute_id uuid REFERENCES programme_graduate_attributes(id) ON DELETE SET NULL,
  lens_version_id uuid REFERENCES lens_versions(id) ON DELETE SET NULL,
  curated_structure_group_id uuid REFERENCES curated_structure_groups(id) ON DELETE SET NULL,
  curated_structure_item_id uuid REFERENCES curated_structure_items(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  module_descriptor_id uuid REFERENCES module_descriptors(id) ON DELETE SET NULL,
  observed_level scaffolding_level NOT NULL DEFAULT 'not_applicable',
  source competency_evaluation_source NOT NULL DEFAULT 'human',
  status competency_evaluation_status NOT NULL DEFAULT 'draft',
  confidence real,
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX competency_evaluations_institution_idx ON competency_evaluations (institution_id);
CREATE INDEX competency_evaluations_programme_idx ON competency_evaluations (programme_version_id);
CREATE INDEX competency_evaluations_competency_idx ON competency_evaluations (competency_id);
CREATE INDEX competency_evaluations_attribute_idx ON competency_evaluations (programme_graduate_attribute_id);
CREATE INDEX competency_evaluations_lens_idx ON competency_evaluations (lens_version_id);
CREATE INDEX competency_evaluations_group_idx ON competency_evaluations (curated_structure_group_id);
CREATE INDEX competency_evaluations_item_idx ON competency_evaluations (curated_structure_item_id);
CREATE INDEX competency_evaluations_module_idx ON competency_evaluations (module_id);
CREATE INDEX competency_evaluations_descriptor_idx ON competency_evaluations (module_descriptor_id);
CREATE INDEX competency_evaluations_status_source_idx ON competency_evaluations (status, source);

CREATE TABLE competency_evaluation_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_evaluation_id uuid NOT NULL REFERENCES competency_evaluations(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relevance real,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX competency_evaluation_evidence_unique ON competency_evaluation_evidence_links (competency_evaluation_id, evidence_item_id);
CREATE INDEX competency_evaluation_evidence_item_idx ON competency_evaluation_evidence_links (evidence_item_id);
