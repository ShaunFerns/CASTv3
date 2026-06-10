-- CAST v3 Phase 7C: SWOT and action planning traceability links.
--
-- Existing Phase 2F tables already provide SWOT items, action plans, action
-- items, milestones and core evidence/finding links. These additive join tables
-- fill the remaining Phase 7C traceability paths for review notes, readiness
-- observations and direct claim/finding-to-action references.

create table if not exists swot_item_readiness_links (
  id uuid primary key default gen_random_uuid(),
  swot_item_id uuid not null references swot_items(id) on delete cascade,
  readiness_assessment_item_id uuid not null references readiness_assessment_items(id) on delete cascade,
  relationship text not null default 'informs',
  notes text,
  created_at timestamptz not null default now(),
  constraint swot_item_readiness_unique unique (swot_item_id, readiness_assessment_item_id)
);

create index if not exists swot_item_readiness_readiness_idx
  on swot_item_readiness_links(readiness_assessment_item_id);

create table if not exists swot_item_review_note_links (
  id uuid primary key default gen_random_uuid(),
  swot_item_id uuid not null references swot_items(id) on delete cascade,
  review_note_id uuid not null references review_notes(id) on delete cascade,
  relationship text not null default 'informs',
  notes text,
  created_at timestamptz not null default now(),
  constraint swot_item_review_note_unique unique (swot_item_id, review_note_id)
);

create index if not exists swot_item_review_note_note_idx
  on swot_item_review_note_links(review_note_id);

create table if not exists action_plan_item_claim_links (
  id uuid primary key default gen_random_uuid(),
  action_plan_item_id uuid not null references action_plan_items(id) on delete cascade,
  ai_claim_id uuid not null references ai_claims(id) on delete cascade,
  relationship text not null default 'informs',
  notes text,
  created_at timestamptz not null default now(),
  constraint action_plan_item_claim_unique unique (action_plan_item_id, ai_claim_id)
);

create index if not exists action_plan_item_claim_claim_idx
  on action_plan_item_claim_links(ai_claim_id);

create table if not exists action_plan_item_human_review_links (
  id uuid primary key default gen_random_uuid(),
  action_plan_item_id uuid not null references action_plan_items(id) on delete cascade,
  human_review_id uuid not null references human_reviews(id) on delete cascade,
  relationship text not null default 'informs',
  notes text,
  created_at timestamptz not null default now(),
  constraint action_plan_item_human_review_unique unique (action_plan_item_id, human_review_id)
);

create index if not exists action_plan_item_human_review_review_idx
  on action_plan_item_human_review_links(human_review_id);

create table if not exists action_plan_item_review_note_links (
  id uuid primary key default gen_random_uuid(),
  action_plan_item_id uuid not null references action_plan_items(id) on delete cascade,
  review_note_id uuid not null references review_notes(id) on delete cascade,
  relationship text not null default 'informs',
  notes text,
  created_at timestamptz not null default now(),
  constraint action_plan_item_review_note_unique unique (action_plan_item_id, review_note_id)
);

create index if not exists action_plan_item_review_note_note_idx
  on action_plan_item_review_note_links(review_note_id);

alter table swot_item_readiness_links enable row level security;
alter table swot_item_review_note_links enable row level security;
alter table action_plan_item_claim_links enable row level security;
alter table action_plan_item_human_review_links enable row level security;
alter table action_plan_item_review_note_links enable row level security;

revoke all on swot_item_readiness_links from anon, authenticated;
revoke all on swot_item_review_note_links from anon, authenticated;
revoke all on action_plan_item_claim_links from anon, authenticated;
revoke all on action_plan_item_human_review_links from anon, authenticated;
revoke all on action_plan_item_review_note_links from anon, authenticated;
