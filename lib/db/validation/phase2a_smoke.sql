BEGIN;

WITH inserted_institution AS (
  INSERT INTO institutions (slug, name, country_code, timezone)
  VALUES ('phase2a-smoke', 'CAST Phase 2A Smoke Institution', 'IE', 'Europe/Dublin')
  RETURNING id
),
inserted_user AS (
  INSERT INTO users (email, display_name, status)
  VALUES ('phase2a-smoke@example.invalid', 'Phase 2A Smoke User', 'active')
  RETURNING id
),
inserted_audit AS (
  INSERT INTO audit_events (
    institution_id,
    actor_type,
    actor_user_id,
    action_type,
    subject_type,
    metadata
  )
  SELECT
    inserted_institution.id,
    'user',
    inserted_user.id,
    'phase2a_smoke_started',
    'institution',
    '{"smoke": true}'::jsonb
  FROM inserted_institution, inserted_user
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM inserted_institution) AS institutions_inserted,
  (SELECT COUNT(*) FROM inserted_user) AS users_inserted,
  (SELECT COUNT(*) FROM inserted_audit) AS audit_events_inserted;

WITH institution_row AS (
  SELECT id FROM institutions WHERE slug = 'phase2a-smoke'
),
framework_row AS (
  INSERT INTO frameworks (institution_id, key, name, owner_type, status)
  SELECT id, 'smoke-framework', 'Smoke Framework', 'institution', 'active'
  FROM institution_row
  RETURNING id
),
framework_version_row AS (
  INSERT INTO framework_versions (framework_id, version_label, status, definition)
  SELECT id, 'v1', 'active', '{"domains": []}'::jsonb
  FROM framework_row
  RETURNING id
),
lens_row AS (
  INSERT INTO lenses (institution_id, key, name, status)
  SELECT id, 'smoke-lens', 'Smoke Lens', 'active'
  FROM institution_row
  RETURNING id
),
lens_version_row AS (
  INSERT INTO lens_versions (lens_id, version_label, status, analysis_contract, output_contract)
  SELECT id, 'v1', 'active', '{"mode": "smoke"}'::jsonb, '{"outputs": []}'::jsonb
  FROM lens_row
  RETURNING id
),
lens_binding_row AS (
  INSERT INTO lens_framework_bindings (lens_version_id, framework_id, framework_version_id, binding_role)
  SELECT lens_version_row.id, framework_row.id, framework_version_row.id, 'primary'
  FROM lens_version_row, framework_row, framework_version_row
  RETURNING id
),
programme_map_row AS (
  INSERT INTO programme_maps (institution_id, key, name, status)
  SELECT id, 'smoke-map', 'Smoke Programme Map', 'draft'
  FROM institution_row
  RETURNING id
),
programme_map_version_row AS (
  INSERT INTO programme_map_versions (programme_map_id, version_label, status, snapshot)
  SELECT id, 'v1', 'draft', '{"smoke": true}'::jsonb
  FROM programme_map_row
  RETURNING id
),
programme_map_layer_row AS (
  INSERT INTO programme_map_layers (programme_map_version_id, key, name, layer_type, order_index)
  SELECT id, 'smoke-layer', 'Smoke Layer', 'lens', 0
  FROM programme_map_version_row
  RETURNING id
),
programme_map_cell_row AS (
  INSERT INTO programme_map_cells (programme_map_layer_id, row_key, column_key, value, status)
  SELECT id, 'stage-1', 'smoke-lens', '{"level": "introduce"}'::jsonb, 'human_reviewed'
  FROM programme_map_layer_row
  RETURNING id
),
priority_row AS (
  INSERT INTO institution_priorities (institution_id, key, name, status)
  SELECT id, 'smoke-priority', 'Smoke Priority', 'active'
  FROM institution_row
  RETURNING id
),
priority_version_row AS (
  INSERT INTO institution_priority_versions (institution_priority_id, version_label, status, definition)
  SELECT id, 'v1', 'active', '{"strategic_priority": true}'::jsonb
  FROM priority_row
  RETURNING id
),
priority_mapping_row AS (
  INSERT INTO priority_mappings (institution_priority_version_id, target_type, target_id, mapping)
  SELECT id, 'programme_map', (SELECT id::text FROM programme_map_row), '{"relationship": "supports"}'::jsonb
  FROM priority_version_row
  RETURNING id
),
priority_expectation_row AS (
  INSERT INTO priority_expectations (institution_priority_version_id, target_type, target_id, expected_level, rationale)
  SELECT id, 'programme_map', (SELECT id::text FROM programme_map_row), 'integrate', 'Smoke expectation'
  FROM priority_version_row
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM framework_row) AS frameworks_inserted,
  (SELECT COUNT(*) FROM lens_row) AS lenses_inserted,
  (SELECT COUNT(*) FROM lens_binding_row) AS lens_bindings_inserted,
  (SELECT COUNT(*) FROM programme_map_row) AS programme_maps_inserted,
  (SELECT COUNT(*) FROM programme_map_cell_row) AS programme_map_cells_inserted,
  (SELECT COUNT(*) FROM priority_row) AS priorities_inserted,
  (SELECT COUNT(*) FROM priority_mapping_row) AS priority_mappings_inserted,
  (SELECT COUNT(*) FROM priority_expectation_row) AS priority_expectations_inserted;

SELECT COUNT(*) AS institutions_read FROM institutions WHERE slug = 'phase2a-smoke';
SELECT COUNT(*) AS frameworks_read FROM frameworks WHERE key = 'smoke-framework';
SELECT COUNT(*) AS lenses_read FROM lenses WHERE key = 'smoke-lens';
SELECT COUNT(*) AS programme_maps_read FROM programme_maps WHERE key = 'smoke-map';
SELECT COUNT(*) AS institution_priorities_read FROM institution_priorities WHERE key = 'smoke-priority';
SELECT COUNT(*) AS audit_events_read FROM audit_events WHERE action_type = 'phase2a_smoke_started';

SELECT COUNT(*) AS legacy_module_reviews_still_readable FROM module_reviews;
SELECT COUNT(*) AS legacy_programmes_still_readable FROM programmes;
SELECT COUNT(*) AS compat_legacy_module_reviews_readable FROM compat_legacy_module_reviews;
SELECT COUNT(*) AS compat_legacy_programmes_readable FROM compat_legacy_programmes;

ROLLBACK;
