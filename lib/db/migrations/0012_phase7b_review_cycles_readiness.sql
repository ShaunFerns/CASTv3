-- CAST v3 Phase 7B: review cycle participants and review notes.
--
-- Existing Phase 2F tables already provide review_cycles, readiness_assessments,
-- readiness_assessment_items and review_exports. These additive tables support
-- named review participants and evidence-aware review observations without
-- requiring full identity management for external reviewers or contributors.

create table if not exists review_cycle_participants (
  id uuid primary key default gen_random_uuid(),
  review_cycle_id uuid not null references review_cycles(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  name text not null,
  role text not null,
  status text not null default 'active',
  comments text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_cycle_participants_cycle_idx
  on review_cycle_participants(review_cycle_id);

create index if not exists review_cycle_participants_institution_idx
  on review_cycle_participants(institution_id);

create index if not exists review_cycle_participants_role_status_idx
  on review_cycle_participants(role, status);

create table if not exists review_notes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  review_cycle_id uuid not null references review_cycles(id) on delete cascade,
  programme_version_id uuid references programme_versions(id) on delete set null,
  module_id uuid references modules(id) on delete set null,
  ai_claim_id uuid references ai_claims(id) on delete set null,
  human_review_id uuid references human_reviews(id) on delete set null,
  programme_map_id uuid references programme_maps(id) on delete set null,
  programme_map_cell_id uuid references programme_map_cells(id) on delete set null,
  note_type text not null default 'observation',
  title text,
  body text not null,
  visibility text not null default 'review_team',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_notes_institution_idx
  on review_notes(institution_id);

create index if not exists review_notes_cycle_idx
  on review_notes(review_cycle_id);

create index if not exists review_notes_programme_idx
  on review_notes(programme_version_id);

create index if not exists review_notes_module_idx
  on review_notes(module_id);

create index if not exists review_notes_claim_idx
  on review_notes(ai_claim_id);

create index if not exists review_notes_human_review_idx
  on review_notes(human_review_id);

create index if not exists review_notes_map_idx
  on review_notes(programme_map_id);

create index if not exists review_notes_map_cell_idx
  on review_notes(programme_map_cell_id);

create index if not exists review_notes_type_idx
  on review_notes(note_type);

alter table review_cycle_participants enable row level security;
alter table review_notes enable row level security;

revoke all on review_cycle_participants from anon, authenticated;
revoke all on review_notes from anon, authenticated;
