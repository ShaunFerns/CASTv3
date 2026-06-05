ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'programme_version';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'module';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'module_descriptor';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'descriptor_section';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'curated_structure';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'curated_structure_group';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'curated_structure_item';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'learning_outcome';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'assessment_component';

ALTER TYPE reconciliation_target_type ADD VALUE IF NOT EXISTS 'module_descriptor';
ALTER TYPE reconciliation_target_type ADD VALUE IF NOT EXISTS 'curated_structure';

CREATE TYPE curriculum_version_status AS ENUM (
  'draft',
  'active',
  'archived',
  'superseded'
);

CREATE TYPE module_status AS ENUM (
  'draft',
  'active',
  'inactive',
  'archived'
);

CREATE TYPE descriptor_section_type AS ENUM (
  'aims',
  'learning_outcomes',
  'indicative_content',
  'teaching_and_learning_strategy',
  'assessment',
  'requisites',
  'resources',
  'graduate_attributes',
  'modality',
  'other'
);

CREATE TYPE curated_structure_status AS ENUM (
  'draft',
  'active',
  'archived'
);

CREATE TYPE curated_structure_group_type AS ENUM (
  'stage',
  'semester',
  'pathway',
  'option_group',
  'elective_group',
  'award_route',
  'custom'
);

CREATE TYPE curated_structure_item_type AS ENUM (
  'module',
  'placeholder',
  'choice',
  'note'
);

CREATE TYPE core_option_status AS ENUM (
  'core',
  'option',
  'elective',
  'required',
  'optional',
  'unknown'
);

CREATE TYPE learning_outcome_status AS ENUM (
  'draft',
  'active',
  'archived'
);

CREATE TYPE assessment_component_status AS ENUM (
  'draft',
  'active',
  'archived'
);

CREATE TABLE programme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  source_programme_id uuid REFERENCES source_programmes(id) ON DELETE SET NULL,
  legacy_programme_id integer,
  programme_key text NOT NULL,
  programme_code text,
  programme_name text,
  version_label text NOT NULL,
  status curriculum_version_status NOT NULL DEFAULT 'draft',
  academic_year text,
  award text,
  level text,
  school text,
  department text,
  campus text,
  mode_of_delivery text,
  total_credits real,
  effective_from timestamptz,
  effective_to timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX programme_versions_institution_key_label_unique ON programme_versions (institution_id, programme_key, version_label);
CREATE INDEX programme_versions_institution_idx ON programme_versions (institution_id);
CREATE INDEX programme_versions_source_programme_idx ON programme_versions (source_programme_id);
CREATE INDEX programme_versions_legacy_programme_idx ON programme_versions (legacy_programme_id);
CREATE INDEX programme_versions_code_idx ON programme_versions (programme_code);
CREATE INDEX programme_versions_status_idx ON programme_versions (status);

CREATE TABLE modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  source_module_id uuid REFERENCES source_modules(id) ON DELETE SET NULL,
  legacy_module_review_id integer,
  module_code text,
  module_title text,
  status module_status NOT NULL DEFAULT 'draft',
  school text,
  department text,
  campus text,
  discipline_family text,
  default_credits real,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX modules_institution_code_unique ON modules (institution_id, module_code) WHERE module_code IS NOT NULL;
CREATE INDEX modules_institution_idx ON modules (institution_id);
CREATE INDEX modules_source_module_idx ON modules (source_module_id);
CREATE INDEX modules_legacy_module_review_idx ON modules (legacy_module_review_id);
CREATE INDEX modules_status_idx ON modules (status);

CREATE TABLE module_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  source_module_id uuid REFERENCES source_modules(id) ON DELETE SET NULL,
  legacy_module_review_id integer,
  version_label text NOT NULL,
  status curriculum_version_status NOT NULL DEFAULT 'draft',
  descriptor_text text,
  source_type text,
  effective_from timestamptz,
  effective_to timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX module_descriptors_module_label_unique ON module_descriptors (module_id, version_label);
CREATE INDEX module_descriptors_institution_idx ON module_descriptors (institution_id);
CREATE INDEX module_descriptors_source_module_idx ON module_descriptors (source_module_id);
CREATE INDEX module_descriptors_legacy_module_review_idx ON module_descriptors (legacy_module_review_id);
CREATE INDEX module_descriptors_status_idx ON module_descriptors (status);

CREATE TABLE descriptor_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  module_descriptor_id uuid NOT NULL REFERENCES module_descriptors(id) ON DELETE CASCADE,
  section_type descriptor_section_type NOT NULL DEFAULT 'other',
  title text,
  content text,
  order_index integer NOT NULL DEFAULT 0,
  source_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX descriptor_sections_institution_idx ON descriptor_sections (institution_id);
CREATE INDEX descriptor_sections_descriptor_idx ON descriptor_sections (module_descriptor_id);
CREATE INDEX descriptor_sections_type_idx ON descriptor_sections (section_type);

CREATE TABLE learning_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  module_descriptor_id uuid NOT NULL REFERENCES module_descriptors(id) ON DELETE CASCADE,
  descriptor_section_id uuid REFERENCES descriptor_sections(id) ON DELETE SET NULL,
  outcome_code text,
  outcome_text text,
  order_index integer NOT NULL DEFAULT 0,
  status learning_outcome_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX learning_outcomes_institution_idx ON learning_outcomes (institution_id);
CREATE INDEX learning_outcomes_descriptor_idx ON learning_outcomes (module_descriptor_id);
CREATE INDEX learning_outcomes_section_idx ON learning_outcomes (descriptor_section_id);
CREATE INDEX learning_outcomes_status_idx ON learning_outcomes (status);

CREATE TABLE assessment_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  module_descriptor_id uuid NOT NULL REFERENCES module_descriptors(id) ON DELETE CASCADE,
  descriptor_section_id uuid REFERENCES descriptor_sections(id) ON DELETE SET NULL,
  component_name text,
  component_type text,
  assessment_mode text,
  weighting real,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  status assessment_component_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assessment_components_institution_idx ON assessment_components (institution_id);
CREATE INDEX assessment_components_descriptor_idx ON assessment_components (module_descriptor_id);
CREATE INDEX assessment_components_section_idx ON assessment_components (descriptor_section_id);
CREATE INDEX assessment_components_status_idx ON assessment_components (status);

CREATE TABLE curated_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_version_id uuid NOT NULL REFERENCES programme_versions(id) ON DELETE CASCADE,
  source_programme_id uuid REFERENCES source_programmes(id) ON DELETE SET NULL,
  legacy_programme_id integer,
  key text NOT NULL,
  name text,
  status curated_structure_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX curated_structures_programme_key_unique ON curated_structures (programme_version_id, key);
CREATE INDEX curated_structures_institution_idx ON curated_structures (institution_id);
CREATE INDEX curated_structures_source_programme_idx ON curated_structures (source_programme_id);
CREATE INDEX curated_structures_legacy_programme_idx ON curated_structures (legacy_programme_id);
CREATE INDEX curated_structures_status_idx ON curated_structures (status);

CREATE TABLE curated_structure_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  curated_structure_id uuid NOT NULL REFERENCES curated_structures(id) ON DELETE CASCADE,
  parent_group_id uuid REFERENCES curated_structure_groups(id) ON DELETE CASCADE,
  source_structure_item_id uuid REFERENCES source_structure_items(id) ON DELETE SET NULL,
  group_type curated_structure_group_type NOT NULL DEFAULT 'custom',
  key text NOT NULL,
  name text,
  stage text,
  semester text,
  pathway text,
  min_credits real,
  max_credits real,
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX curated_structure_groups_structure_key_unique ON curated_structure_groups (curated_structure_id, key);
CREATE INDEX curated_structure_groups_institution_idx ON curated_structure_groups (institution_id);
CREATE INDEX curated_structure_groups_structure_idx ON curated_structure_groups (curated_structure_id);
CREATE INDEX curated_structure_groups_parent_idx ON curated_structure_groups (parent_group_id);
CREATE INDEX curated_structure_groups_source_item_idx ON curated_structure_groups (source_structure_item_id);
CREATE INDEX curated_structure_groups_type_idx ON curated_structure_groups (group_type);

CREATE TABLE curated_structure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  curated_structure_id uuid NOT NULL REFERENCES curated_structures(id) ON DELETE CASCADE,
  curated_structure_group_id uuid REFERENCES curated_structure_groups(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  module_descriptor_id uuid REFERENCES module_descriptors(id) ON DELETE SET NULL,
  source_structure_item_id uuid REFERENCES source_structure_items(id) ON DELETE SET NULL,
  source_module_id uuid REFERENCES source_modules(id) ON DELETE SET NULL,
  legacy_programme_module_id integer,
  item_type curated_structure_item_type NOT NULL DEFAULT 'module',
  core_option core_option_status NOT NULL DEFAULT 'unknown',
  stage text,
  semester text,
  pathway text,
  credits real,
  order_index integer NOT NULL DEFAULT 0,
  label text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX curated_structure_items_institution_idx ON curated_structure_items (institution_id);
CREATE INDEX curated_structure_items_structure_idx ON curated_structure_items (curated_structure_id);
CREATE INDEX curated_structure_items_group_idx ON curated_structure_items (curated_structure_group_id);
CREATE INDEX curated_structure_items_module_idx ON curated_structure_items (module_id);
CREATE INDEX curated_structure_items_descriptor_idx ON curated_structure_items (module_descriptor_id);
CREATE INDEX curated_structure_items_source_item_idx ON curated_structure_items (source_structure_item_id);
CREATE INDEX curated_structure_items_source_module_idx ON curated_structure_items (source_module_id);
CREATE INDEX curated_structure_items_legacy_idx ON curated_structure_items (legacy_programme_module_id);

ALTER TABLE programme_maps
  ADD CONSTRAINT programme_maps_programme_version_fk
  FOREIGN KEY (programme_version_id)
  REFERENCES programme_versions(id)
  ON DELETE SET NULL;
