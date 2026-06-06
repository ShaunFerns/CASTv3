# CAST v3 Roadmap

## Current Position

Phase 1 and Phase 2 establish a portable production foundation and the additive CAST v3 domain model.

Completed:

- CAST runs and builds outside Replit.
- PNPM lockfile is standard and cross-platform pruning overrides are removed.
- Environment examples and local-development documentation exist.
- Existing prototype functionality remains available.
- Seven additive migrations define the future tenant, curriculum, evidence, analysis, review, quality and local-worker model.
- Fresh CAST v3 deployments do not require legacy prototype tables.
- Legacy compatibility views are optional and isolated for prototype migration environments.
- Typecheck, frontend build, backend build and local startup smoke tests pass.

Not yet completed:

- Full ordered migration validation against real PostgreSQL.
- Production identity, tenant enforcement and persistent sessions.
- Workflow migration from legacy tables to Phase 2 tables.
- Local-worker runtime.
- Production object storage, queueing, monitoring and backup controls.

## Guiding Sequence

CAST should move from schema foundation to production workflows incrementally:

1. Validate and secure the foundation.
2. Establish reliable import and curation services.
3. Build the evidence and analysis pipeline.
4. Deliver programme maps and review workflows.
5. Add operational scale, hybrid workers and benchmarking.

## Phase 3: Validate and Secure the Foundation

### 3A. PostgreSQL Migration Validation

- Apply migrations `0001` through `0007` in order to disposable PostgreSQL.
- Verify all enums, tables, indexes, constraints and foreign keys.
- Keep optional prototype compatibility migrations separate from the clean production baseline.
- Add repeatable migration integration tests.
- Introduce a migration journal and controlled deploy command.
- Remove `push-force` from production deployment.
- Define rollback and forward-fix procedures.

Exit criteria: a clean database can be created from migrations in CI and a production-like environment.

### 3B. Identity, Tenancy and Authorization

- Replace single-admin environment authentication.
- Integrate institution-ready identity, initially OIDC/SAML-capable.
- Add persistent sessions.
- Define platform, institution, programme and review roles.
- Enforce tenant ownership in services and database access.
- Assess PostgreSQL row-level security.
- Add tenant-isolation tests.

Exit criteria: users can access only authorized institution and programme data.

### 3C. Production Operations

- Introduce managed object storage for documents and exports.
- Add secrets management, backups and restore testing.
- Add structured monitoring, tracing and alerting.
- Define retention, deletion and audit policies.
- Add security scanning and dependency-update policy.
- Resolve frontend chunk-size and sourcemap warnings.

Exit criteria: CAST can be operated safely in a production-like environment.

## Phase 4: Source Import and Curated Curriculum Services

### 4A. Import Pipeline

- Implement source-system adapters, beginning with Akari-compatible imports.
- Store immutable source records and import batches.
- Add parsing, validation and reconciliation services.
- Surface stale imports, orphaned modules and missing structures.
- Support repeat imports without overwriting source history.

### 4B. Curated Programme Workspace

- Create programme versions from reconciled imports.
- Build editable curated structures for stages, semesters, pathways and choices.
- Add module descriptor versioning and structured sections.
- Introduce explicit publish/approval states.
- Preserve source-versus-curated comparison.

Exit criteria: a programme team can import, reconcile and curate one complete programme without using legacy tables.

## Phase 5: Evidence and Curriculum Intelligence

### 5A. Evidence Pipeline

- Upload and version programme, validation, accreditation and policy documents.
- Extract sections while retaining page and character provenance.
- Link descriptor sections, learning outcomes and assessment components as evidence.
- Add evidence search, tagging and coverage reporting.

### 5B. Framework and Lens Administration

- Seed GreenComp, DigComp, EntreComp, UDL, Assessment, Modality and Graduate Attribute configurations.
- Provide institution-defined lenses and strategic priorities.
- Add lens versioning, testing and controlled activation.
- Define output-schema validation.

### 5C. Competency Expectations and Progression

- Configure programme-owned graduate attributes.
- Define programme competency expectations by programme, stage, semester, pathway, group and module.
- Analyse Introduce, Develop, Integrate and Demonstrate progression.
- Distinguish intended scaffolding from observed evidence.

Exit criteria: CAST can produce an evidence-linked progression analysis for one curated programme.

## Phase 6: AI Claims and Human Review

- Implement queued analysis runs and model-run provenance.
- Generate evidence-linked claims rather than direct classifications.
- Add human accept, reject, amend, clarification and not-applicable workflows.
- Build descriptor-improvement suggestions without automatic descriptor updates.
- Add model evaluation, prompt-version comparison and cost monitoring.
- Define institutional AI governance and data-processing controls.

Exit criteria: AI-supported findings are fully traceable and cannot become institutional truth without human review.

## Phase 7: Programme Maps and Review Workflows

### 7A. Layered Programme Maps

- Deliver programme maps as a flagship programme-led workspace.
- Combine framework, lens, progression, assessment, modality, readiness and data-quality layers.
- Add annotations, approvals, comparison and exports.
- Support map snapshots for review evidence packs.

### 7B. Review and Readiness

- Implement generic review cycles and participant assignments.
- Build evidence-informed readiness assessments.
- Support programme review, validation, revalidation, accreditation and DELTA-style readiness.
- Keep final institutional judgements outside automated assessment.

### 7C. SWOT and Action Planning

- Create evidence-linked SWOT items.
- Convert approved findings into owned action plans.
- Track partners, milestones, indicators, priorities and approvals.
- Produce review and action-plan exports.

Exit criteria: a programme team can move from evidence to reviewed findings and an approved action plan.

## Phase 8: Data Quality and Hybrid Processing

### 8A. Data Quality Dashboards

- Implement rules for missing programme links, orphaned modules, stages, semesters, descriptors and learning outcomes.
- Detect duplicate mappings, stale imports, weak assessment data and unmapped competencies.
- Provide programme and institution quality dashboards.
- Track acknowledgment, resolution, accepted risk and false positives.
- Never silently clean source records.

### 8B. Local Worker Runtime

- Implement secure worker registration and key rotation.
- Add pull, callback and hybrid job protocols.
- Run document extraction, embeddings, classification and batch analysis locally.
- Sync claims, evidence metadata and artifact references back to CAST.
- Enforce local-required and restricted data-handling policies.
- Add retry, idempotency, artifact-retention and worker-health controls.

Exit criteria: an institution can process a privacy-sensitive document locally and sync evidence-linked results without uploading the source document.

## Phase 9: Commercial Product Readiness

- Add institutional onboarding, configuration and support tooling.
- Add usage metering, service-level objectives and operational reporting.
- Complete accessibility, privacy and security reviews.
- Establish framework-content governance and licensing.
- Build export packs for validation and accreditation contexts.
- Add anonymous benchmarking only after consent, minimum cohort and de-identification controls are proven.

## Recommended Immediate Priorities

1. Validate migrations `0001` through `0007` against disposable PostgreSQL.
2. Replace `push-force` with controlled migration execution.
3. Implement production authentication, persistent sessions and tenant-isolation tests.
4. Select one pilot programme and migrate the import-to-curated-structure workflow.
5. Establish document storage and evidence-provenance services.
6. Build the first layered programme map using curated programme data.
7. Introduce data-quality dashboards before scaling analysis.

## Migration Strategy

- Keep legacy and Phase 2 schemas side by side during workflow migration.
- Migrate one bounded workflow at a time.
- Prefer dual-read comparison before switching writes.
- Preserve legacy identifiers and reconciliation records.
- Add compatibility views or adapters where old routes still require legacy shapes.
- Require verification and rollback plans before each workflow cutover.
- Remove legacy tables only after usage, data and rollback audits confirm they are no longer required.
