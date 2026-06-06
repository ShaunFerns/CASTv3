SELECT 'enums' AS object_kind, COUNT(*) AS found
FROM pg_type
WHERE typname IN (
  'institution_status',
  'user_status',
  'membership_status',
  'role_scope',
  'framework_status',
  'lens_status',
  'lens_configuration_scope',
  'lens_rule_type',
  'programme_map_status',
  'programme_map_layer_type',
  'programme_map_cell_status',
  'programme_map_export_format',
  'priority_status',
  'priority_mapping_target_type',
  'priority_expectation_level',
  'audit_actor_type',
  'audit_subject_type'
);

SELECT 'tables' AS object_kind, COUNT(*) AS found
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'institutions',
    'users',
    'roles',
    'institution_memberships',
    'membership_roles',
    'frameworks',
    'framework_versions',
    'lenses',
    'lens_versions',
    'lens_groups',
    'lens_group_members',
    'lens_configurations',
    'lens_framework_bindings',
    'lens_output_schemas',
    'lens_evidence_rules',
    'programme_maps',
    'programme_map_versions',
    'programme_map_layers',
    'programme_map_layer_sources',
    'programme_map_cells',
    'programme_map_annotations',
    'programme_map_exports',
    'institution_priorities',
    'institution_priority_versions',
    'priority_mappings',
    'priority_expectations',
    'audit_events'
  );

SELECT 'indexes' AS object_kind, COUNT(*) AS found
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'institutions_slug_unique',
    'frameworks_global_key_unique',
    'lenses_global_key_unique',
    'programme_maps_institution_key_unique',
    'institution_priorities_institution_key_unique',
    'audit_events_subject_idx'
  );

SELECT 'foreign_keys' AS object_kind, COUNT(*) AS found
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND constraint_type = 'FOREIGN KEY'
  AND table_name IN (
    'institution_memberships',
    'framework_versions',
    'lens_versions',
    'lens_framework_bindings',
    'programme_map_versions',
    'programme_map_layers',
    'institution_priority_versions',
    'priority_mappings',
    'priority_expectations',
    'audit_events'
  );
