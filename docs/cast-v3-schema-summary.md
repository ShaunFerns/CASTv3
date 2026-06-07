# CAST v3 Schema Summary

## Status

CAST v3 currently exposes 105 Drizzle tables in code:

- 100 additive production tables created by the core migration chain through Phase 4A.
- 5 legacy prototype tables retained in code for compatibility with existing prototype workflows.
- 91 production PostgreSQL enums.
- 9 ordered core SQL migrations.
- 1 optional legacy compatibility-view migration for prototype migration environments.

Fresh CAST v3 deployments do not require legacy tables. No legacy product workflow has yet been migrated to the new model.

## Migration Sequence

| Migration                                     | Phase | Purpose                                                                 |
| --------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `0001_phase2a_foundation.sql`                 | 2A    | Tenant access, frameworks, lenses, programme maps, priorities and audit |
| `0002_phase2b_source_imports.sql`             | 2B    | Immutable source imports and reconciliation                             |
| `0003_phase2c_curated_curriculum.sql`         | 2C    | Versioned programmes, modules, descriptors and curated structures       |
| `0004_phase2d_evidence_framework.sql`         | 2D    | Documents, evidence, competencies, graduate attributes and expectations |
| `0005_phase2e_ai_review_improvement.sql`      | 2E    | AI claims, human review, clarification and descriptor suggestions       |
| `0006_phase2f_review_readiness_action.sql`    | 2F    | Review cycles, readiness, SWOT, action planning and exports             |
| `0007_phase2g_data_quality_local_workers.sql` | 2G    | Data quality and optional local-worker execution scaffolding            |
| `0008_phase3b_identity_sessions_roles.sql`    | 3B-1  | Auth identity mapping, PostgreSQL sessions and programme memberships    |
| `0009_phase4a_curriculum_ingestion.sql`        | 4A    | Cross-pathway curriculum ingestion runs, items, errors and record links |
| `0090_legacy_compatibility_views.sql`         | Optional | Compatibility views for prototype migration environments only        |

Core migrations `0001` through `0009` are additive and depend on the preceding migrations being applied in order. The optional `0090` migration is not part of the clean production baseline.

## Optional Legacy Compatibility

Legacy compatibility is only used when migrating from the prototype. The optional compatibility migration creates `compat_legacy_*` views only when the corresponding legacy tables exist.

| Legacy table         | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `module_reviews`     | Existing prototype module review and analysis records |
| `programmes`         | Existing prototype programme records                  |
| `programme_modules`  | Existing prototype programme/module links             |
| `ga_classifications` | Existing prototype graduate-attribute classifications |
| `audit_logs`         | Existing prototype audit log                          |

Phase 2 records retain selected legacy identifiers where needed to support incremental migration.

## Phase 2 Tables by Context

### Tenant and Access

| Table                     | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `institutions`            | Tenant boundary and institution metadata |
| `users`                   | Platform identities                      |
| `app_sessions`            | PostgreSQL-backed Express sessions       |
| `roles`                   | Global or institution-defined roles      |
| `institution_memberships` | User membership within an institution    |
| `membership_roles`        | Role assignments for memberships         |
| `programme_memberships`   | Programme team membership and roles      |

### Frameworks and Lenses

| Table                     | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `frameworks`              | External, system or institution-owned frameworks |
| `framework_versions`      | Versioned framework definitions                  |
| `lenses`                  | Configurable evidence-analysis perspectives      |
| `lens_versions`           | Versioned analysis and output contracts          |
| `lens_groups`             | Organised groups of lenses                       |
| `lens_group_members`      | Lens membership and ordering                     |
| `lens_configurations`     | Global, institution or programme configuration   |
| `lens_framework_bindings` | Relationships between lenses and frameworks      |
| `lens_output_schemas`     | Structured lens output definitions               |
| `lens_evidence_rules`     | Evidence selection, weighting and prompt rules   |

### Programme Maps

| Table                         | Purpose                                                |
| ----------------------------- | ------------------------------------------------------ |
| `programme_maps`              | First-class programme maps                             |
| `programme_map_versions`      | Versioned map snapshots                                |
| `programme_map_layers`        | Framework, lens, priority, assessment or quality layers |
| `programme_map_layer_sources` | Sources used by each layer                             |
| `programme_map_cells`         | Layer positions and values                             |
| `programme_map_annotations`   | Human annotations                                      |
| `programme_map_exports`       | Export requests and artifacts                          |

### Institutional Priorities

| Table                           | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `institution_priorities`        | Institution-owned strategic priorities                 |
| `institution_priority_versions` | Versioned priority definitions                         |
| `priority_mappings`             | Priority relationships to curriculum/framework targets |
| `priority_expectations`         | Expected evidence maturity levels                      |

### Audit

| Table          | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `audit_events` | Tenant-aware audit events for legacy and Phase 2 subjects |

### Source Imports

| Table                    | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `source_systems`         | Akari or other source-system registrations       |
| `import_batches`         | Import execution and status                      |
| `source_records`         | Immutable raw source records                     |
| `source_programmes`      | Parsed source programme records                  |
| `source_modules`         | Parsed source module records                     |
| `source_structure_items` | Parsed source structure records                  |
| `reconciliation_links`   | Source-to-CAST matching without source overwrite |

### Curriculum Ingestion

| Table                    | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `ingestion_runs`         | Tenant-owned lifecycle for Akari, PDF/text, manual and future wizard flows |
| `ingestion_items`        | Per-row or per-document work items and normalized payloads                 |
| `ingestion_errors`       | Non-destructive ingestion warnings and errors                              |
| `ingestion_record_links` | Created or matched source, document, descriptor, evidence and quality rows |

Ingestion is pathway-neutral after materialisation. Downstream evidence and analysis services should read documents, descriptor sections and evidence items rather than testing whether a record came from Akari, PDF or manual entry.

### Curated Curriculum

| Table                      | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `programme_versions`       | Versioned editable programme records          |
| `modules`                  | Institution-owned module identities           |
| `module_descriptors`       | Versioned module descriptors                  |
| `descriptor_sections`      | Typed descriptor content sections             |
| `learning_outcomes`        | Structured learning outcomes                  |
| `assessment_components`    | Structured assessment information             |
| `curated_structures`       | Editable programme structures                 |
| `curated_structure_groups` | Stages, semesters, pathways and option groups |
| `curated_structure_items`  | Modules, choices, placeholders and notes      |

### Evidence and Competency

| Table                                  | Purpose                                        |
| -------------------------------------- | ---------------------------------------------- |
| `documents`                            | Logical evidence documents                     |
| `document_versions`                    | Versioned files, text and checksums            |
| `document_sections`                    | Precisely located document sections            |
| `evidence_items`                       | Evidence observations linked to exact sources  |
| `evidence_tags`                        | Reusable evidence tags                         |
| `evidence_item_tags`                   | Evidence/tag relationships                     |
| `competency_domains`                   | Framework-version competency domains           |
| `competencies`                         | Framework-version competencies                 |
| `programme_graduate_attributes`        | Programme-owned graduate attributes            |
| `programme_attribute_expectations`     | Programme attribute expectations by scope      |
| `programme_competency_expectations`    | Competency expectations by programme scope     |
| `competency_evaluations`               | Observed evidence-based competency evaluations |
| `competency_evaluation_evidence_links` | Evaluation provenance                          |

Evidence maturity values are `none`, `developing`, `consolidating` and `leading`.

CAST uses these values to describe curriculum evidence maturity across framework layers. They are not learner attainment or learner progression claims.

### AI Claims and Human Review

| Table                                | Purpose                                             |
| ------------------------------------ | --------------------------------------------------- |
| `prompt_versions`                    | Versioned prompts and output contracts              |
| `analysis_runs`                      | Analysis execution boundary                         |
| `ai_model_runs`                      | Provider, model, token and execution metadata       |
| `ai_claims`                          | Evidence-linked AI observations and recommendations |
| `claim_evidence_links`               | Claim provenance                                    |
| `descriptor_improvement_suggestions` | Non-destructive descriptor suggestions              |
| `human_reviews`                      | Human decisions on claims and suggestions           |
| `clarification_requests`             | Staff clarification without evidence overwrite      |

### Review, Readiness, SWOT and Action Planning

| Table group     | Tables                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Review          | `review_cycles`, `review_assignments`, `review_exports`                                                                                                                                                                        |
| Readiness       | `readiness_assessments`, `readiness_assessment_items`, `readiness_assessment_item_evidence_links`, `readiness_assessment_item_claim_links`                                                                                     |
| SWOT            | `swot_items`, `swot_item_evidence_links`, `swot_item_claim_links`, `swot_item_human_review_links`, `swot_item_programme_map_links`, `swot_item_competency_links`, `swot_item_priority_links`                                   |
| Action planning | `action_plans`, `action_plan_items`, `action_plan_item_partners`, `action_plan_milestones`, `action_plan_item_swot_links`, `action_plan_item_readiness_links`, `action_plan_evidence_links`, `action_plan_item_priority_links` |

Review cycles support programme review, validation, revalidation, accreditation, DELTA readiness and institutional-priority review.

### Data Quality and Local Workers

| Table                       | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `data_quality_rules`        | Global or institution-specific quality rules      |
| `data_quality_runs`         | Quality execution context                         |
| `data_quality_results`      | Non-destructive quality findings                  |
| `data_quality_result_links` | Exact links to affected source or curated records |
| `local_workers`             | Optional institution-local worker registrations   |
| `worker_jobs`               | Privacy-aware queued analysis jobs                |
| `worker_job_artifacts`      | Checksummed artifact metadata and locations       |
| `worker_sync_events`        | Idempotent worker/CAST synchronization events     |

Data-quality target links use restrictive foreign keys so findings cannot silently lose provenance.

## Key Relationship Patterns

### Source to Curated

Source records are preserved. Curated records may reference source programmes, modules and structure items, while reconciliation links capture uncertain or confirmed matches.

### Evidence to Interpretation

Document and descriptor sections produce evidence items. Evidence items support competency evaluations, AI claims, readiness findings, SWOT items and action plans.

### Expectations to Observations

Programme attribute and competency expectations describe expected evidence maturity. Competency evaluations and claims describe observed evidence maturity. They remain separate so evidence never silently replaces programme intent.

Phase 5 reuses the existing framework, lens, competency, programme expectation and evaluation tables for GreenComp, LifeComp, EntreComp and DigComp. No additional schema was required for framework layers, expected-versus-observed analysis or programme-owned framework foundations.

### AI to Human Authority

AI claims link to evidence and execution metadata. Human reviews and clarification requests provide institutional interpretation. Descriptor suggestions remain separate from official descriptor text.

### Programme Maps

Maps are versioned and layered. Map cells may represent framework, lens, priority, readiness, quality or custom views over one programme context.

## Validation Status

- Drizzle schema compiles successfully.
- Migrations and schema table/index definitions have been checked for parity during each Phase 2 implementation.
- Application typecheck, frontend build, backend build and local health smoke tests pass.
- Core migrations `0001` through `0008` have been applied and smoke-tested against clean Supabase PostgreSQL.
- The validated Supabase baseline contains 96 production tables, 91 enums, 508 indexes and 330 foreign keys after `0008`.

Before production use, apply migrations `0001` through `0008` to disposable PostgreSQL and verify tables, enums, indexes, constraints and representative inserts.
