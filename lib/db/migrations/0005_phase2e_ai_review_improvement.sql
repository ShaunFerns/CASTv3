ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'analysis_run';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'ai_model_run';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'ai_claim';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'human_review';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'clarification_request';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'descriptor_improvement_suggestion';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'prompt_version';

CREATE TYPE analysis_run_type AS ENUM (
  'evidence_extraction',
  'framework_analysis',
  'competency_analysis',
  'descriptor_review',
  'descriptor_improvement',
  'readiness_analysis',
  'other'
);
CREATE TYPE analysis_run_status AS ENUM (
  'pending',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled'
);
CREATE TYPE prompt_version_status AS ENUM ('draft', 'active', 'retired');
CREATE TYPE ai_model_run_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE ai_claim_type AS ENUM (
  'competency_observation',
  'strength',
  'gap',
  'recommendation',
  'descriptor_issue',
  'readiness_observation',
  'other'
);
CREATE TYPE ai_claim_status AS ENUM ('draft', 'needs_review', 'accepted', 'rejected', 'amended', 'superseded');
CREATE TYPE human_review_decision AS ENUM ('accept', 'reject', 'amend', 'request_clarification', 'not_applicable');
CREATE TYPE human_review_subject_type AS ENUM ('ai_claim', 'descriptor_improvement_suggestion');
CREATE TYPE clarification_status AS ENUM ('open', 'answered', 'resolved', 'cancelled');
CREATE TYPE clarification_subject_type AS ENUM ('ai_claim', 'descriptor_improvement_suggestion');
CREATE TYPE descriptor_suggestion_type AS ENUM (
  'improve_clarity',
  'strengthen_evidence',
  'align_competency',
  'improve_scaffolding',
  'improve_assessment',
  'improve_udl',
  'improve_modality',
  'other'
);
CREATE TYPE descriptor_suggestion_status AS ENUM ('draft', 'needs_review', 'accepted', 'rejected', 'exported', 'superseded');

CREATE TABLE prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  version_label text NOT NULL,
  status prompt_version_status NOT NULL DEFAULT 'draft',
  system_prompt text,
  user_prompt_template text,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX prompt_versions_institution_key_label_unique ON prompt_versions (institution_id, key, version_label);
CREATE UNIQUE INDEX prompt_versions_global_key_label_unique ON prompt_versions (key, version_label) WHERE institution_id IS NULL;
CREATE INDEX prompt_versions_institution_idx ON prompt_versions (institution_id);
CREATE INDEX prompt_versions_status_idx ON prompt_versions (status);

CREATE TABLE analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  run_type analysis_run_type NOT NULL,
  status analysis_run_status NOT NULL DEFAULT 'pending',
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  module_descriptor_id uuid REFERENCES module_descriptors(id) ON DELETE SET NULL,
  lens_version_id uuid REFERENCES lens_versions(id) ON DELETE SET NULL,
  framework_version_id uuid REFERENCES framework_versions(id) ON DELETE SET NULL,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analysis_runs_institution_idx ON analysis_runs (institution_id);
CREATE INDEX analysis_runs_type_status_idx ON analysis_runs (run_type, status);
CREATE INDEX analysis_runs_programme_idx ON analysis_runs (programme_version_id);
CREATE INDEX analysis_runs_module_idx ON analysis_runs (module_id);
CREATE INDEX analysis_runs_descriptor_idx ON analysis_runs (module_descriptor_id);
CREATE INDEX analysis_runs_lens_idx ON analysis_runs (lens_version_id);
CREATE INDEX analysis_runs_framework_idx ON analysis_runs (framework_version_id);

CREATE TABLE ai_model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  analysis_run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  prompt_version_id uuid REFERENCES prompt_versions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  status ai_model_run_status NOT NULL DEFAULT 'pending',
  model_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost real,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_model_runs_institution_idx ON ai_model_runs (institution_id);
CREATE INDEX ai_model_runs_analysis_idx ON ai_model_runs (analysis_run_id);
CREATE INDEX ai_model_runs_prompt_idx ON ai_model_runs (prompt_version_id);
CREATE INDEX ai_model_runs_provider_model_idx ON ai_model_runs (provider, model);
CREATE INDEX ai_model_runs_status_idx ON ai_model_runs (status);

CREATE TABLE ai_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  analysis_run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  ai_model_run_id uuid REFERENCES ai_model_runs(id) ON DELETE SET NULL,
  prompt_version_id uuid REFERENCES prompt_versions(id) ON DELETE SET NULL,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  module_id uuid REFERENCES modules(id) ON DELETE SET NULL,
  module_descriptor_id uuid REFERENCES module_descriptors(id) ON DELETE SET NULL,
  descriptor_section_id uuid REFERENCES descriptor_sections(id) ON DELETE SET NULL,
  curated_structure_item_id uuid REFERENCES curated_structure_items(id) ON DELETE SET NULL,
  lens_version_id uuid REFERENCES lens_versions(id) ON DELETE SET NULL,
  framework_version_id uuid REFERENCES framework_versions(id) ON DELETE SET NULL,
  competency_id uuid REFERENCES competencies(id) ON DELETE SET NULL,
  programme_graduate_attribute_id uuid REFERENCES programme_graduate_attributes(id) ON DELETE SET NULL,
  claim_type ai_claim_type NOT NULL DEFAULT 'other',
  status ai_claim_status NOT NULL DEFAULT 'draft',
  title text,
  claim_text text NOT NULL,
  rationale text,
  observed_level scaffolding_level,
  confidence real,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_claims_institution_idx ON ai_claims (institution_id);
CREATE INDEX ai_claims_analysis_idx ON ai_claims (analysis_run_id);
CREATE INDEX ai_claims_model_run_idx ON ai_claims (ai_model_run_id);
CREATE INDEX ai_claims_prompt_idx ON ai_claims (prompt_version_id);
CREATE INDEX ai_claims_programme_idx ON ai_claims (programme_version_id);
CREATE INDEX ai_claims_module_idx ON ai_claims (module_id);
CREATE INDEX ai_claims_descriptor_idx ON ai_claims (module_descriptor_id);
CREATE INDEX ai_claims_section_idx ON ai_claims (descriptor_section_id);
CREATE INDEX ai_claims_lens_idx ON ai_claims (lens_version_id);
CREATE INDEX ai_claims_framework_idx ON ai_claims (framework_version_id);
CREATE INDEX ai_claims_competency_idx ON ai_claims (competency_id);
CREATE INDEX ai_claims_attribute_idx ON ai_claims (programme_graduate_attribute_id);
CREATE INDEX ai_claims_type_status_idx ON ai_claims (claim_type, status);

CREATE TABLE claim_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_claim_id uuid NOT NULL REFERENCES ai_claims(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relevance real,
  relationship text NOT NULL DEFAULT 'supports',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX claim_evidence_links_claim_evidence_unique ON claim_evidence_links (ai_claim_id, evidence_item_id);
CREATE INDEX claim_evidence_links_evidence_idx ON claim_evidence_links (evidence_item_id);

CREATE TABLE descriptor_improvement_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  analysis_run_id uuid REFERENCES analysis_runs(id) ON DELETE SET NULL,
  ai_model_run_id uuid REFERENCES ai_model_runs(id) ON DELETE SET NULL,
  ai_claim_id uuid REFERENCES ai_claims(id) ON DELETE SET NULL,
  module_descriptor_id uuid NOT NULL REFERENCES module_descriptors(id) ON DELETE CASCADE,
  descriptor_section_id uuid NOT NULL REFERENCES descriptor_sections(id) ON DELETE CASCADE,
  lens_version_id uuid REFERENCES lens_versions(id) ON DELETE SET NULL,
  framework_version_id uuid REFERENCES framework_versions(id) ON DELETE SET NULL,
  competency_id uuid REFERENCES competencies(id) ON DELETE SET NULL,
  programme_graduate_attribute_id uuid REFERENCES programme_graduate_attributes(id) ON DELETE SET NULL,
  suggestion_type descriptor_suggestion_type NOT NULL DEFAULT 'other',
  status descriptor_suggestion_status NOT NULL DEFAULT 'draft',
  intended_level scaffolding_level,
  evidence_gap_summary text,
  original_text text,
  suggested_text text NOT NULL,
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX descriptor_suggestions_institution_idx ON descriptor_improvement_suggestions (institution_id);
CREATE INDEX descriptor_suggestions_analysis_idx ON descriptor_improvement_suggestions (analysis_run_id);
CREATE INDEX descriptor_suggestions_claim_idx ON descriptor_improvement_suggestions (ai_claim_id);
CREATE INDEX descriptor_suggestions_descriptor_idx ON descriptor_improvement_suggestions (module_descriptor_id);
CREATE INDEX descriptor_suggestions_section_idx ON descriptor_improvement_suggestions (descriptor_section_id);
CREATE INDEX descriptor_suggestions_lens_idx ON descriptor_improvement_suggestions (lens_version_id);
CREATE INDEX descriptor_suggestions_framework_idx ON descriptor_improvement_suggestions (framework_version_id);
CREATE INDEX descriptor_suggestions_competency_idx ON descriptor_improvement_suggestions (competency_id);
CREATE INDEX descriptor_suggestions_attribute_idx ON descriptor_improvement_suggestions (programme_graduate_attribute_id);
CREATE INDEX descriptor_suggestions_type_status_idx ON descriptor_improvement_suggestions (suggestion_type, status);

CREATE TABLE human_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subject_type human_review_subject_type NOT NULL,
  ai_claim_id uuid REFERENCES ai_claims(id) ON DELETE CASCADE,
  descriptor_improvement_suggestion_id uuid REFERENCES descriptor_improvement_suggestions(id) ON DELETE CASCADE,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision human_review_decision NOT NULL,
  amended_text text,
  rationale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_reviews_subject_check CHECK (
    (subject_type = 'ai_claim' AND ai_claim_id IS NOT NULL AND descriptor_improvement_suggestion_id IS NULL)
    OR
    (subject_type = 'descriptor_improvement_suggestion' AND descriptor_improvement_suggestion_id IS NOT NULL AND ai_claim_id IS NULL)
  )
);

CREATE INDEX human_reviews_institution_idx ON human_reviews (institution_id);
CREATE INDEX human_reviews_claim_idx ON human_reviews (ai_claim_id);
CREATE INDEX human_reviews_suggestion_idx ON human_reviews (descriptor_improvement_suggestion_id);
CREATE INDEX human_reviews_reviewer_idx ON human_reviews (reviewer_user_id);
CREATE INDEX human_reviews_subject_decision_idx ON human_reviews (subject_type, decision);

CREATE TABLE clarification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subject_type clarification_subject_type NOT NULL,
  ai_claim_id uuid REFERENCES ai_claims(id) ON DELETE CASCADE,
  descriptor_improvement_suggestion_id uuid REFERENCES descriptor_improvement_suggestions(id) ON DELETE CASCADE,
  human_review_id uuid REFERENCES human_reviews(id) ON DELETE SET NULL,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status clarification_status NOT NULL DEFAULT 'open',
  question text NOT NULL,
  response text,
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clarification_requests_subject_check CHECK (
    (subject_type = 'ai_claim' AND ai_claim_id IS NOT NULL AND descriptor_improvement_suggestion_id IS NULL)
    OR
    (subject_type = 'descriptor_improvement_suggestion' AND descriptor_improvement_suggestion_id IS NOT NULL AND ai_claim_id IS NULL)
  )
);

CREATE INDEX clarification_requests_institution_idx ON clarification_requests (institution_id);
CREATE INDEX clarification_requests_claim_idx ON clarification_requests (ai_claim_id);
CREATE INDEX clarification_requests_suggestion_idx ON clarification_requests (descriptor_improvement_suggestion_id);
CREATE INDEX clarification_requests_review_idx ON clarification_requests (human_review_id);
CREATE INDEX clarification_requests_assignee_idx ON clarification_requests (assigned_to_user_id);
CREATE INDEX clarification_requests_subject_status_idx ON clarification_requests (subject_type, status);
