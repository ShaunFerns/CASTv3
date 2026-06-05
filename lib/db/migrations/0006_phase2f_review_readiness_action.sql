ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'review_cycle';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'readiness_assessment';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'readiness_assessment_item';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'swot_item';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'action_plan';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'action_plan_item';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'action_plan_milestone';
ALTER TYPE audit_subject_type ADD VALUE IF NOT EXISTS 'review_export';

CREATE TYPE review_cycle_type AS ENUM (
  'programme_review',
  'validation',
  'revalidation',
  'accreditation',
  'delta_readiness',
  'institutional_priority_review',
  'other'
);
CREATE TYPE review_cycle_status AS ENUM (
  'draft',
  'planned',
  'active',
  'awaiting_approval',
  'approved',
  'completed',
  'cancelled',
  'archived'
);
CREATE TYPE review_assignment_role AS ENUM (
  'owner',
  'lead',
  'contributor',
  'reviewer',
  'approver',
  'external_reviewer',
  'observer'
);
CREATE TYPE review_assignment_status AS ENUM ('invited', 'active', 'completed', 'declined', 'removed');
CREATE TYPE readiness_assessment_status AS ENUM (
  'draft',
  'in_progress',
  'awaiting_review',
  'reviewed',
  'approved',
  'archived'
);
CREATE TYPE readiness_rating AS ENUM (
  'not_assessed',
  'emerging',
  'developing',
  'established',
  'leading',
  'not_applicable'
);
CREATE TYPE readiness_item_status AS ENUM (
  'draft',
  'needs_evidence',
  'needs_review',
  'reviewed',
  'approved',
  'not_applicable'
);
CREATE TYPE swot_item_type AS ENUM ('strength', 'weakness', 'opportunity', 'threat');
CREATE TYPE swot_item_status AS ENUM ('draft', 'reviewed', 'approved', 'archived');
CREATE TYPE action_plan_status AS ENUM (
  'draft',
  'active',
  'awaiting_approval',
  'approved',
  'completed',
  'cancelled',
  'archived'
);
CREATE TYPE action_plan_item_status AS ENUM ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled');
CREATE TYPE action_plan_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE action_plan_milestone_status AS ENUM ('not_started', 'in_progress', 'completed', 'missed', 'cancelled');
CREATE TYPE review_export_format AS ENUM ('pdf', 'docx', 'xlsx', 'csv', 'json');
CREATE TYPE review_export_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  institution_priority_version_id uuid REFERENCES institution_priority_versions(id) ON DELETE SET NULL,
  cycle_type review_cycle_type NOT NULL,
  status review_cycle_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  methodology text,
  owner_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  approved_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  started_at timestamptz,
  due_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_cycles_institution_idx ON review_cycles (institution_id);
CREATE INDEX review_cycles_programme_idx ON review_cycles (programme_version_id);
CREATE INDEX review_cycles_priority_idx ON review_cycles (institution_priority_version_id);
CREATE INDEX review_cycles_type_status_idx ON review_cycles (cycle_type, status);
CREATE INDEX review_cycles_owner_idx ON review_cycles (owner_membership_id);

CREATE TABLE review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_cycle_id uuid NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES institution_memberships(id) ON DELETE CASCADE,
  role review_assignment_role NOT NULL,
  status review_assignment_status NOT NULL DEFAULT 'invited',
  responsibilities text,
  is_required boolean NOT NULL DEFAULT true,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX review_assignments_cycle_membership_role_unique
  ON review_assignments (review_cycle_id, membership_id, role);
CREATE INDEX review_assignments_membership_idx ON review_assignments (membership_id);
CREATE INDEX review_assignments_role_status_idx ON review_assignments (role, status);

CREATE TABLE readiness_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  review_cycle_id uuid NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  lens_version_id uuid REFERENCES lens_versions(id) ON DELETE SET NULL,
  framework_version_id uuid REFERENCES framework_versions(id) ON DELETE SET NULL,
  institution_priority_version_id uuid REFERENCES institution_priority_versions(id) ON DELETE SET NULL,
  status readiness_assessment_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  summary text,
  overall_rating readiness_rating NOT NULL DEFAULT 'not_assessed',
  methodology text,
  owner_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  approved_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX readiness_assessments_institution_idx ON readiness_assessments (institution_id);
CREATE INDEX readiness_assessments_review_cycle_idx ON readiness_assessments (review_cycle_id);
CREATE INDEX readiness_assessments_programme_idx ON readiness_assessments (programme_version_id);
CREATE INDEX readiness_assessments_lens_idx ON readiness_assessments (lens_version_id);
CREATE INDEX readiness_assessments_framework_idx ON readiness_assessments (framework_version_id);
CREATE INDEX readiness_assessments_priority_idx ON readiness_assessments (institution_priority_version_id);
CREATE INDEX readiness_assessments_status_idx ON readiness_assessments (status);

CREATE TABLE readiness_assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  readiness_assessment_id uuid NOT NULL REFERENCES readiness_assessments(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES competencies(id) ON DELETE SET NULL,
  programme_graduate_attribute_id uuid REFERENCES programme_graduate_attributes(id) ON DELETE SET NULL,
  lens_version_id uuid REFERENCES lens_versions(id) ON DELETE SET NULL,
  framework_version_id uuid REFERENCES framework_versions(id) ON DELETE SET NULL,
  institution_priority_version_id uuid REFERENCES institution_priority_versions(id) ON DELETE SET NULL,
  criterion_key text NOT NULL,
  title text NOT NULL,
  finding text,
  rationale text,
  rating readiness_rating NOT NULL DEFAULT 'not_assessed',
  status readiness_item_status NOT NULL DEFAULT 'draft',
  order_index integer NOT NULL DEFAULT 0,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  approved_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX readiness_items_assessment_criterion_unique
  ON readiness_assessment_items (readiness_assessment_id, criterion_key);
CREATE INDEX readiness_items_competency_idx ON readiness_assessment_items (competency_id);
CREATE INDEX readiness_items_attribute_idx ON readiness_assessment_items (programme_graduate_attribute_id);
CREATE INDEX readiness_items_lens_idx ON readiness_assessment_items (lens_version_id);
CREATE INDEX readiness_items_framework_idx ON readiness_assessment_items (framework_version_id);
CREATE INDEX readiness_items_priority_idx ON readiness_assessment_items (institution_priority_version_id);
CREATE INDEX readiness_items_rating_status_idx ON readiness_assessment_items (rating, status);

CREATE TABLE readiness_assessment_item_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  readiness_assessment_item_id uuid NOT NULL REFERENCES readiness_assessment_items(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'supports',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX readiness_item_evidence_unique
  ON readiness_assessment_item_evidence_links (readiness_assessment_item_id, evidence_item_id);
CREATE INDEX readiness_item_evidence_evidence_idx ON readiness_assessment_item_evidence_links (evidence_item_id);

CREATE TABLE readiness_assessment_item_claim_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  readiness_assessment_item_id uuid NOT NULL REFERENCES readiness_assessment_items(id) ON DELETE CASCADE,
  ai_claim_id uuid NOT NULL REFERENCES ai_claims(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'informs',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX readiness_item_claim_unique
  ON readiness_assessment_item_claim_links (readiness_assessment_item_id, ai_claim_id);
CREATE INDEX readiness_item_claim_claim_idx ON readiness_assessment_item_claim_links (ai_claim_id);

CREATE TABLE swot_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  review_cycle_id uuid NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  item_type swot_item_type NOT NULL,
  status swot_item_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  rationale text,
  owner_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  impact integer,
  likelihood integer,
  approved_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX swot_items_institution_idx ON swot_items (institution_id);
CREATE INDEX swot_items_review_cycle_idx ON swot_items (review_cycle_id);
CREATE INDEX swot_items_programme_idx ON swot_items (programme_version_id);
CREATE INDEX swot_items_type_status_idx ON swot_items (item_type, status);

CREATE TABLE swot_item_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swot_item_id uuid NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'informs',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX swot_item_evidence_unique ON swot_item_evidence_links (swot_item_id, evidence_item_id);
CREATE INDEX swot_item_evidence_evidence_idx ON swot_item_evidence_links (evidence_item_id);

CREATE TABLE swot_item_claim_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swot_item_id uuid NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  ai_claim_id uuid NOT NULL REFERENCES ai_claims(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'informs',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX swot_item_claim_unique ON swot_item_claim_links (swot_item_id, ai_claim_id);
CREATE INDEX swot_item_claim_claim_idx ON swot_item_claim_links (ai_claim_id);

CREATE TABLE swot_item_human_review_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swot_item_id uuid NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  human_review_id uuid NOT NULL REFERENCES human_reviews(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX swot_item_human_review_unique
  ON swot_item_human_review_links (swot_item_id, human_review_id);
CREATE INDEX swot_item_human_review_review_idx ON swot_item_human_review_links (human_review_id);

CREATE TABLE swot_item_programme_map_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swot_item_id uuid NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  programme_map_id uuid NOT NULL REFERENCES programme_maps(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX swot_item_programme_map_unique
  ON swot_item_programme_map_links (swot_item_id, programme_map_id);
CREATE INDEX swot_item_programme_map_map_idx ON swot_item_programme_map_links (programme_map_id);

CREATE TABLE swot_item_competency_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swot_item_id uuid NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX swot_item_competency_unique
  ON swot_item_competency_links (swot_item_id, competency_id);
CREATE INDEX swot_item_competency_competency_idx ON swot_item_competency_links (competency_id);

CREATE TABLE swot_item_priority_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swot_item_id uuid NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  institution_priority_version_id uuid NOT NULL REFERENCES institution_priority_versions(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX swot_item_priority_unique
  ON swot_item_priority_links (swot_item_id, institution_priority_version_id);
CREATE INDEX swot_item_priority_priority_idx ON swot_item_priority_links (institution_priority_version_id);

CREATE TABLE action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  review_cycle_id uuid NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  programme_version_id uuid REFERENCES programme_versions(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status action_plan_status NOT NULL DEFAULT 'draft',
  owner_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  indicators_of_success text,
  start_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  approved_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX action_plans_institution_idx ON action_plans (institution_id);
CREATE INDEX action_plans_review_cycle_idx ON action_plans (review_cycle_id);
CREATE INDEX action_plans_programme_idx ON action_plans (programme_version_id);
CREATE INDEX action_plans_status_idx ON action_plans (status);
CREATE INDEX action_plans_owner_idx ON action_plans (owner_membership_id);

CREATE TABLE action_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status action_plan_item_status NOT NULL DEFAULT 'not_started',
  priority action_plan_priority NOT NULL DEFAULT 'medium',
  owner_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  timeframe text,
  indicators_of_success text,
  order_index integer NOT NULL DEFAULT 0,
  start_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  approved_by_membership_id uuid REFERENCES institution_memberships(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX action_plan_items_plan_idx ON action_plan_items (action_plan_id);
CREATE INDEX action_plan_items_status_priority_idx ON action_plan_items (status, priority);
CREATE INDEX action_plan_items_owner_idx ON action_plan_items (owner_membership_id);
CREATE INDEX action_plan_items_due_idx ON action_plan_items (due_at);

CREATE TABLE action_plan_item_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_item_id uuid NOT NULL REFERENCES action_plan_items(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES institution_memberships(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'partner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX action_plan_item_partners_unique
  ON action_plan_item_partners (action_plan_item_id, membership_id, role);
CREATE INDEX action_plan_item_partners_membership_idx ON action_plan_item_partners (membership_id);

CREATE TABLE action_plan_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_item_id uuid NOT NULL REFERENCES action_plan_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status action_plan_milestone_status NOT NULL DEFAULT 'not_started',
  order_index integer NOT NULL DEFAULT 0,
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX action_plan_milestones_item_idx ON action_plan_milestones (action_plan_item_id);
CREATE INDEX action_plan_milestones_status_due_idx ON action_plan_milestones (status, due_at);

CREATE TABLE action_plan_item_swot_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_item_id uuid NOT NULL REFERENCES action_plan_items(id) ON DELETE CASCADE,
  swot_item_id uuid NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX action_plan_item_swot_unique
  ON action_plan_item_swot_links (action_plan_item_id, swot_item_id);
CREATE INDEX action_plan_item_swot_swot_idx ON action_plan_item_swot_links (swot_item_id);

CREATE TABLE action_plan_item_readiness_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_item_id uuid NOT NULL REFERENCES action_plan_items(id) ON DELETE CASCADE,
  readiness_assessment_item_id uuid NOT NULL REFERENCES readiness_assessment_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX action_plan_item_readiness_unique
  ON action_plan_item_readiness_links (action_plan_item_id, readiness_assessment_item_id);
CREATE INDEX action_plan_item_readiness_readiness_idx
  ON action_plan_item_readiness_links (readiness_assessment_item_id);

CREATE TABLE action_plan_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_item_id uuid NOT NULL REFERENCES action_plan_items(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'informs',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX action_plan_evidence_unique
  ON action_plan_evidence_links (action_plan_item_id, evidence_item_id);
CREATE INDEX action_plan_evidence_evidence_idx ON action_plan_evidence_links (evidence_item_id);

CREATE TABLE action_plan_item_priority_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_item_id uuid NOT NULL REFERENCES action_plan_items(id) ON DELETE CASCADE,
  institution_priority_version_id uuid NOT NULL REFERENCES institution_priority_versions(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX action_plan_item_priority_unique
  ON action_plan_item_priority_links (action_plan_item_id, institution_priority_version_id);
CREATE INDEX action_plan_item_priority_priority_idx
  ON action_plan_item_priority_links (institution_priority_version_id);

CREATE TABLE review_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  review_cycle_id uuid NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  format review_export_format NOT NULL,
  status review_export_status NOT NULL DEFAULT 'pending',
  storage_key text,
  error_message text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_exports_institution_idx ON review_exports (institution_id);
CREATE INDEX review_exports_review_cycle_idx ON review_exports (review_cycle_id);
CREATE INDEX review_exports_status_idx ON review_exports (status);
